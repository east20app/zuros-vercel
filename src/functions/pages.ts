export default class PageSystem {
    data: any[];
    maxItemPerPage: number;
    totalPages: number;

    constructor({ data, maxItemPerPage = 24 }: { data: any[], maxItemPerPage: number }) {
        this.data = data;
        this.maxItemPerPage = maxItemPerPage > 0 ? maxItemPerPage : 24;
        this.totalPages = Math.max(1, Math.ceil(data.length / this.maxItemPerPage));
    }

    // BUG CORRIGIDO: page=0 ou negativo gerava um `start` negativo e o
    // `.slice()` contava a partir do fim do array, retornando itens errados
    // em vez de uma página vazia/clampada.
    getPage(page: number) {
        const safePage = Math.min(Math.max(1, page), this.totalPages);
        const start = (safePage - 1) * this.maxItemPerPage;
        const end = start + this.maxItemPerPage;

        return this.data.slice(start, end);
    }
}