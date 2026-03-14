// js/store.js
// Global Alpine stores: cart, notification

document.addEventListener('alpine:init', () => {

  Alpine.store('cart', {
    eventId: null,
    eventName: '',
    items: [],       // [{ ticketTypeId, name, type, priceCents, quantity, takesSeat, groupQty }]
    buyerName: '',
    buyerEmail: '',
    buyerNationalId: '',

    addItem(ticketType) {
      const existing = this.items.find(i => i.ticketTypeId === ticketType.id);
      if (existing) {
        existing.quantity++;
        return;
      }
      this.items.push({
        ticketTypeId: ticketType.id,
        name: ticketType.name,
        type: ticketType.type,
        priceCents: ticketType.price_cents,
        quantity: 1,
        takesSeat: ticketType.takes_seat,
        groupQty: ticketType.quantity,
      });
    },

    removeItem(ticketTypeId) {
      this.items = this.items.filter(i => i.ticketTypeId !== ticketTypeId);
    },

    updateQuantity(ticketTypeId, qty) {
      const item = this.items.find(i => i.ticketTypeId === ticketTypeId);
      if (!item) return;
      if (qty <= 0) { this.removeItem(ticketTypeId); return; }
      item.quantity = qty;
    },

    get totalCents() {
      return this.items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);
    },

    get totalItems() {
      return this.items.reduce((sum, i) => sum + i.quantity, 0);
    },

    get hasDonation() {
      return this.items.some(i => i.type === 'donation' || i.type === 'donation_custom');
    },

    get isEmpty() {
      return this.items.length === 0;
    },

    clear() {
      this.items = [];
      this.buyerName = '';
      this.buyerEmail = '';
      this.buyerNationalId = '';
      this.eventId = null;
      this.eventName = '';
    },

    setEvent(id, name) {
      // If switching events, clear cart
      if (this.eventId && this.eventId !== id) {
        this.items = [];
      }
      this.eventId = id;
      this.eventName = name;
    }
  });

  Alpine.store('notify', {
    message: '',
    type: 'info',
    visible: false,
    _timeout: null,

    show(message, type = 'info', duration = 4000) {
      this.message = message;
      this.type = type;
      this.visible = true;
      clearTimeout(this._timeout);
      this._timeout = setTimeout(() => { this.visible = false; }, duration);
    },
    success(msg) { this.show(msg, 'success'); },
    error(msg) { this.show(msg, 'error', 6000); },
    info(msg) { this.show(msg, 'info'); },
  });

});
