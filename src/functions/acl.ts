import databases from "../databases";
import type { IStores } from "../databases/schemas/stores";
import { env } from "../config/env";

export enum PermissionsStore {
    ADMIN = "admin",
    MANAGE_PRODUCTS = "manage-products",
    MANAGE_SALES = "manage-sales",
    MANAGE_LOGS = "manage-logs",
    USE_CONFIG = "use-config",
    USE_MANAGER = "use-manager",
    DELETE_APPLICATION = "delete-application",
    TOGGLE_APPLICATION = "toggle-application",
    VIEW_APPLICATION_LOGS = "view-application-logs",
    TRANSFER_APPLICATION_OWNERSHIP = "transfer-application-ownership",
    CHANGE_APPLICATION_DURATION = "change-application-duration",
    SEE_BALANCE = "see-balance",
}

export interface IPermissionStore {
    label: string;
    value: PermissionsStore;
    description: string;
}

export const list: IPermissionStore[] = [
    {
        label: "Administrador",
        value: PermissionsStore.ADMIN,
        description: "Permissão total sobre o bot"
    },
    {
        label: "Gerenciar Produtos",
        value: PermissionsStore.MANAGE_PRODUCTS,
        description: "Permite adicionar, remover e editar produtos"
    },
    {
        label: "Gerenciar Vendas",
        value: PermissionsStore.MANAGE_SALES,
        description: "Permite visualizar e editar vendas"
    },
    {
        label: "Gerenciar Logs",
        value: PermissionsStore.MANAGE_LOGS,
        description: "Permite visualizar e editar logs"
    },
    {
        label: "Usar /config",
        value: PermissionsStore.USE_CONFIG,
        description: "Permite usar o comando /config"
    },
    {
        label: "Usar /manager",
        value: PermissionsStore.USE_MANAGER,
        description: "Permite usar o comando /manager"
    },
    {
        label: "Deletar Aplicações",
        value: PermissionsStore.DELETE_APPLICATION,
        description: "Permite deletar aplicações"
    },
    {
        label: "Alternar Aplicações",
        value: PermissionsStore.TOGGLE_APPLICATION,
        description: "Permite alternar aplicações (ligar/desligar)"
    },
    {
        label: "Visualizar Logs de Aplicações",
        value: PermissionsStore.VIEW_APPLICATION_LOGS,
        description: "Permite visualizar logs de aplicações"
    },
    {
        label: "Transferir Propriedade de Aplicações",
        value: PermissionsStore.TRANSFER_APPLICATION_OWNERSHIP,
        description: "Permite transferir a propriedade de aplicações"
    },
    {
        label: "Alterar Duração de Aplicações",
        value: PermissionsStore.CHANGE_APPLICATION_DURATION,
        description: "Permite alterar a duração de aplicações"
    },
    {
        label: "Ver Saldo",
        value: PermissionsStore.SEE_BALANCE,
        description: "Permite ver o saldo do bot"
    }
]

const permissionsModule = {
    get: (): IPermissionStore[] => [...list],    
};

export const getUserHasPermissionOnBOT = async (userId: string) => {
    if (!!userId && !!env.OWNER_ID && userId === env.OWNER_ID){
        return true;
    }else{
        return false;
    }
}

export const getUserHasPermissionOnStore = async ({ userId, storeId, permission }: { userId: string, storeId: string, permission: PermissionsStore }) => {

    // O proprietário global do bot possui acesso administrativo a todas as
    // lojas. Mantém esta verificação alinhada com getUserHasPermissionOnBOT e
    // com a autorização usada pelo painel administrativo.
    if (!!userId && !!env.OWNER_ID && userId === env.OWNER_ID) {
        return true;
    }

    const storeConfig = await databases.stores.findOne({ _id: storeId }, { permissions: 1, ownerId_campos: 1 }).catch(() => null);
    if (!storeConfig) return false;

    const userSettings = await databases.userSettings.findOne({ userId_discord: userId }, { userId_campos: 1 });
    const camposUserId = userSettings?.userId_campos;
    const storeOwnerId = storeConfig.ownerId_campos;
    const isStoreOwner = !!camposUserId && !!storeOwnerId && camposUserId === storeOwnerId;
    const isDiscordOwner = !!userId && !!storeOwnerId && storeOwnerId === `discord:${userId}`;

    if (isStoreOwner || isDiscordOwner){
        return true;
    }

    const userPermission = storeConfig.permissions.find((perm: IStores["permissions"][number]) => perm.userId === userId)?.permissions;
    if (!userPermission){
        return false;
    }

    if (userPermission.includes(PermissionsStore.ADMIN)){
        return true;
    }

    const hasPermission = userPermission.includes(permission);
    if (hasPermission){
        return true;
    }

    return false;
}

export default permissionsModule;
