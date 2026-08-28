import assert from "node:assert/strict";
import test from "node:test";
import { addPercentageFeeCents, applyDiscountCents, calculateCheckoutCents, fromCents, toCents } from "../../src/integration/money.ts";

test("converte dinheiro em centavos com arredondamento previsível", () => {
    assert.equal(toCents(12.29), 1229);
    assert.equal(toCents("5,97"), 597);
    assert.equal(fromCents(1294), 12.94);
    assert.throws(() => toCents(Number.NaN), /inválido/);
});

test("aplica descontos nos limites e rejeita percentuais inválidos", () => {
    assert.equal(applyDiscountCents(1000, 5), 950);
    assert.equal(applyDiscountCents(999, 100), 0);
    assert.throws(() => applyDiscountCents(1000, 100.01), /Desconto inválido/);
});

test("calcula valor líquido, desconto e cobrança PIX somente com inteiros", () => {
    const result = calculateCheckoutCents(12.29, 5, 1.2);
    assert.deepEqual(result, { grossCents: 1229, discountCents: 61, netCents: 1168, chargedCents: 1182 });
    assert.equal(addPercentageFeeCents(1168, 1.2), 1182);
});
