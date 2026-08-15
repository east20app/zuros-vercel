import databases from "../databases";

interface IChangeBalance {
    storeId: string;
    amount: number;
    origin: "sales" | "manual";
    action: "add" | "remove";
    description?: string;
}

/**
 * BUGS CORRIGIDOS:
 * 1) `upsert: true` criava uma loja "fantasma" com só o campo `balance`
 *    caso o storeId não existisse (schema quebrado, sem owner/permissions/etc).
 * 2) O comentário dizia "saldo insuficiente", mas nada validava isso — um
 *    $inc negativo sempre passava e a loja podia ficar com balance negativo.
 * 3) Com upsert:true, quando a loja NÃO existia e era criada do zero,
 *    `modifiedCount` vinha 0 (o Mongo reporta como upsert, não update),
 *    então o código lançava "Loja não encontrada" mesmo tendo acabado de criar.
 * 4) `amount` não era validado (podia ser negativo/NaN, invertendo a lógica).
 */
export const changeBalance = async (data: IChangeBalance) => {
    const { amount, origin, action, description, storeId } = data;

    if (action !== "add" && action !== "remove") {
        throw new Error("Ação inválida. Use 'add' ou 'remove'.");
    }

    if (!storeId) {
        throw new Error("storeId é obrigatório.");
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Valor inválido para alteração de saldo.");
    }

    const filter: Record<string, any> = { _id: storeId };
    const balanceUpdate =
        action === "add"
            ? { $inc: { balance: amount } }
            : { $inc: { balance: -amount } };

    // Para remoção, só aplica o $inc se a loja realmente tiver saldo
    // suficiente. Isso é atômico: evita corrida entre duas remoções
    // simultâneas deixando o saldo negativo.
    if (action === "remove") {
        filter.balance = { $gte: amount };
    }

    const update = await databases.stores.updateOne(filter, balanceUpdate);

    if (update.matchedCount === 0) {
        // Não achou o documento -> ou a loja não existe, ou (no caso de
        // remove) o saldo é insuficiente. Diferenciamos para dar um erro útil.
        const storeExists = await databases.stores.findOne(
            { _id: storeId },
            { _id: 1 }
        );

        if (!storeExists) {
            throw new Error("Loja não encontrada.");
        }

        throw new Error("Saldo insuficiente.");
    }

    const extractData = {
        origin,
        action,
        amount,
        description,
        storeId,
        createdAt: new Date(),
    };

    await databases.extracts.create(extractData);
};