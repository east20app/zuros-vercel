import crypto from "crypto";
import axios from "axios";

const SHARPIFY_GATEWAY_URL = "https://sharpify-pay.com";
const REQUEST_TIMEOUT_MS = 12_000;
export interface SharpifyCredentials { client_id: string; client_secret: string }

type PaymentLink = { id: string; status: "PENDING" | "APPROVED" | "CANCELLED"; payment: { gateway: { expirationDate?: string | null; data: { code?: string; qrCode?: string; paymentLink?: string } } } | null; [key: string]: unknown };
function headers(c: SharpifyCredentials) { return { "Content-Type": "application/json", "x-sharpify-client-id": c.client_id, "x-sharpify-client-secret": c.client_secret }; }
function unwrap<T>(data: any, key?: string): T { return (key ? data?.[key] : data?.data) || data; }
function webhook(c: SharpifyCredentials) {
    const base = (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://app.zuros.site").replace(/\/$/, "");
    const integration = crypto.createHash("sha256").update(c.client_id).digest("hex");
    return { callbackURL: `${base}/api/webhooks/sharpify?integration=${integration}`, headers: [{ key: "x-zuros-sharpify-signature", value: crypto.createHash("sha256").update(c.client_secret).digest("hex") }] };
}

class SharpifyWrapper {
    async createTransaction(c: SharpifyCredentials, amount: number, reference: string) {
        try {
            const response = await axios.post(`${SHARPIFY_GATEWAY_URL}/api/v1/gateway/payment/create-paymnet`, { name: `Pedido ZUROS ${reference}`, description: `Pagamento PIX do pedido ${reference}`, amount: Number(amount.toFixed(2)), gatewayMethod: "PIX", webhook: webhook(c) }, { headers: headers(c), timeout: REQUEST_TIMEOUT_MS });
            const link = unwrap<PaymentLink>(response.data); const data = link?.payment?.gateway?.data;
            if (!link?.id || !data?.code) return null;
            return { id: link.id, copyPaste: data.code, qrCode: data.qrCode || "", paymentLink: data.paymentLink || "", expiresAt: link.payment?.gateway?.expirationDate || null };
        } catch (error: any) { console.error("Sharpify create payment error:", error?.response?.data || error?.message); return null; }
    }
    async getPayment(c: SharpifyCredentials, paymentLinkId: string) {
        try { const r = await axios.get(`${SHARPIFY_GATEWAY_URL}/api/v1/gateway/payment/get-payment`, { params: { paymentLinkId }, headers: headers(c), timeout: REQUEST_TIMEOUT_MS }); return unwrap<PaymentLink>(r.data); }
        catch (error: any) { console.error("Sharpify get payment error:", error?.response?.data || error?.message); return null; }
    }
    async getTransactionStatus(c: SharpifyCredentials, id: string) { const link = await this.getPayment(c, id); return link ? { status: link.status } : null; }
    async refundPayment(c: SharpifyCredentials, paymentLinkId: string, amount: number) {
        try { const r = await axios.post(`${SHARPIFY_GATEWAY_URL}/api/v1/gateway/payment/refund-payment`, { paymentLinkId, amount: Number(amount.toFixed(2)) }, { headers: headers(c), timeout: REQUEST_TIMEOUT_MS }); return r.data; }
        catch (error: any) { console.error("Sharpify refund error:", error?.response?.data || error?.message); return null; }
    }
    async getWithdrawData(c: SharpifyCredentials) {
        try { const r = await axios.get(`${SHARPIFY_GATEWAY_URL}/api/v1/gateway/withdraw/get-withdraw`, { headers: headers(c), timeout: REQUEST_TIMEOUT_MS }); return unwrap<Record<string, any>>(r.data); }
        catch (error: any) { console.error("Sharpify withdraw data error:", error?.response?.data || error?.message); return null; }
    }
    async requestWithdraw(c: SharpifyCredentials, input: { amount: number; payoutData: { fullName: string; pixKey: string; pixType: string } }, idempotencyKey: string) {
        try { const r = await axios.post(`${SHARPIFY_GATEWAY_URL}/api/v1/gateway/withdraw/request-withdraw`, { ...input, webhook: webhook(c) }, { headers: { ...headers(c), "Idempotency-Key": idempotencyKey }, timeout: REQUEST_TIMEOUT_MS }); return unwrap<Record<string, any>>(r.data, "withdraw"); }
        catch (error: any) { console.error("Sharpify withdraw request error:", error?.response?.data || error?.message); return null; }
    }
    async getWithdraw(c: SharpifyCredentials, withdrawId: string) {
        try { const r = await axios.get(`${SHARPIFY_GATEWAY_URL}/api/v1/gateway/withdraw/get-withdrawal`, { params: { withdrawId }, headers: headers(c), timeout: REQUEST_TIMEOUT_MS }); return unwrap<Record<string, any>>(r.data, "withdraw"); }
        catch (error: any) { console.error("Sharpify get withdrawal error:", error?.response?.data || error?.message); return null; }
    }
    async checkIsValidConfig(c: SharpifyCredentials) { if (!c.client_id || !c.client_secret) return false; try { await axios.get(`${SHARPIFY_GATEWAY_URL}/api/v1/gateway/withdraw/get-withdraw`, { headers: headers(c), timeout: REQUEST_TIMEOUT_MS }); return true; } catch { return false; } }
}
export default new SharpifyWrapper();