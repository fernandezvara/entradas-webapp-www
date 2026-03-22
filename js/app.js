
// ============================================================
// SUPABASE CLIENT
// ============================================================
const SUPABASE_URL = 'https://calxwytlgkoooyypscry.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_5nR7-p9o_ORS-qjrMxj4GA_RKm732Gn';
const SUPABASE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

async function testSupabaseConnection() {
  try {
    const { data, error } = await db.from('events').select('count').single();
    if (error) {
      console.error('Supabase connection test failed:', error);
      return false;
    }
    console.log('Supabase connection successful');
    return true;
  } catch (err) {
    console.error('Supabase connection error:', err);
    return false;
  }
}

async function callEdgeFunction(name, body) {
  const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

// ============================================================
// STRIPE CLIENT
// ============================================================
const STRIPE_PUBLISHABLE_KEY = 'pk_test_51SssZNP6Mg3f28KZzoWim4wZYHWJfKrSqyfXVRXsgDAC4pXFM7qw28HgszkDuCN9yP9751WUZ4v1lajWmyqSZY3800sgx3JuxA';

let stripeInstance = null;

function getStripe() {
  if (!stripeInstance) {
    stripeInstance = Stripe(STRIPE_PUBLISHABLE_KEY);
  }
  return stripeInstance;
}

// ============================================================
// GLOBAL STORES
// ============================================================

// Events data store for sharing between components
Alpine.store('eventsData', {
  events: [],
  
  setEvents(events) {
    this.events = events || [];
  },
  
  getEventBySlug(slug) {
    return this.events.find(event => event.slug === slug);
  },
  
  getEventById(id) {
    return this.events.find(event => event.id === id);
  }
});

// Cart store
Alpine.store('cart', {
  eventId: null,
  eventName: '',
  items: [],
  buyerName: '',
  buyerEmail: '',
  buyerNationalId: '',
  _lastOrder: null,

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
    if (this.eventId && this.eventId !== id) { 
      this.items = []; 
    }
    this.eventId = id;
    this.eventName = name;
  }
});

// ============================================================
// ALPINE INIT
// ============================================================
document.addEventListener('alpine:init', () => {
  testSupabaseConnection();

  // ----------------------------------------------------------
  // STORES
  // ----------------------------------------------------------
  Alpine.store('notify', {
    message: '',
    type: 'info',
    show: false,
    timeout: null,

    success(msg) { this.show(msg, 'success', 3000); },
    error(msg) { this.show(msg, 'error', 5000); },
    info(msg) { this.show(msg, 'info', 3000); },

    show(msg, type = 'info', duration = 3000) {
      this.message = msg;
      this.type = type;
      this.show = true;
      if (this.timeout) clearTimeout(this.timeout);
      this.timeout = setTimeout(() => this.show = false, duration);
    }
  });

  Alpine.store('cart', {
    eventName: '',
    items: [],
    buyerName: '',
    buyerEmail: '',
    buyerNationalId: '',
    _lastOrder: null,

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
      if (this.eventId && this.eventId !== id) { 
        this.items = []; 
      }
      this.eventId = id;
      this.eventName = name;
    }
  });

  // ----------------------------------------------------------
  // ROUTER
  // ----------------------------------------------------------
  Alpine.data('app', () => ({
    currentRoute: 'events',
    ready: false,

    init() {
      this.ready = true;
      this.handleRoute();
      window.addEventListener('hashchange', () => this.handleRoute());
    },

    handleRoute() {
      const hash = window.location.hash || '#/';
      if (hash.match(/#\/events\/([a-zA-Z0-9-]+)/)) {
        this.currentRoute = 'event-detail';
      } else if (hash.startsWith('#/checkout')) {
        this.currentRoute = 'checkout';
      } else if (hash.startsWith('#/confirmation')) {
        this.currentRoute = 'confirmation';
      } else {
        this.currentRoute = 'events';
      }
    },

    isRoute(route) {
      return this.currentRoute === route;
    }
  }));

  // ----------------------------------------------------------
  // EVENTS PAGE
  // ----------------------------------------------------------
  Alpine.data('eventsPage', () => ({
    events: [],
    loading: true,

    async init() {
      await this.loadEvents();
    },

    async loadEvents() {
      this.loading = true;
      try {
        const now = new Date().toISOString();
        const { data, error } = await db
          .from('events')
          .select('*')
          .gte('event_date', now)
          .order('event_date', { ascending: true });
        if (error) throw error;
        this.events = data || [];
        
        // Store events in global store for sharing
        Alpine.store('eventsData').setEvents(this.events);
      } catch (err) {
        Alpine.store('notify').error('Error al cargar eventos');
      } finally {
        this.loading = false;
      }
    },

    formatDate(dateStr) {
      return new Date(dateStr).toLocaleDateString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });
    },

    formatTime(dateStr) {
      return new Date(dateStr).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    },

    isAlmostFull(event) {
      return event.available_seats > 0 && event.available_seats <= Math.ceil(event.total_seats * 0.1);
    },

    isSoldOut(event) {
      return event.available_seats <= 0;
    },

    navigateTo(eventSlug) {
      window.location.hash = `#/events/${eventSlug}`;
    }
  }));

  // ----------------------------------------------------------
  // EVENT DETAIL PAGE
  // Event detail page component (from pages/event-detail.js)
  Alpine.data('eventDetailPage', () => ({
    event: null,
    ticketTypes: [],
    loading: true,
    cart: {
      eventId: null,
      eventSlug: null,
      eventName: '',
      items: {}, // ticketTypeId -> quantity
      totalCents: 0
    },

    async init() {
      this.eventSlug = this.getEventSlugFromHash();
      if (!this.eventSlug) { window.location.hash = '#/'; return; }
      await this.loadAll();
    },

    getEventSlugFromHash() {
      const match = window.location.hash.match(/#\/events\/([a-zA-Z0-9-]+)$/);
      return match ? match[1] : null;
    },

    async loadAll() {
      this.loading = true;
      try {
        // First: Try to find event in already-loaded events array
        let event = Alpine.store('eventsData').getEventBySlug(this.eventSlug);
        
        if (!event) {
          // Fallback: load from server if not found (direct access or refresh)
          const { data: eventData, error: eventError } = await db
            .from('events').select('*').eq('slug', this.eventSlug).single();
          if (eventError) throw eventError;
          event = eventData;
        }
        
        // Second: Load ticket types for this specific event (this is necessary)
        const { data: ticketTypes, error: typesError } = await db
          .from('ticket_types').select('*')
          .eq('event_id', event.id)
          .eq('enabled', true)
          .order('sort_order', { ascending: true });
        
        if (typesError) throw typesError;
        
        // Set data
        this.event = event;
        this.cart.eventId = event.id;
        this.cart.eventSlug = event.slug;
        this.cart.eventName = event.name;
        this.ticketTypes = ticketTypes || [];

      } catch (err) {
        console.error('Error loading event:', err);
        Alpine.store('notify').error('Error al cargar evento');
        window.location.hash = '#/';
      } finally {
        this.loading = false;
      }
    },

    get salesOpen() {
      if (!this.event) return false;
      return new Date() < new Date(this.event.sales_cutoff);
    },

    get soldOut() {
      if (!this.event) return false;
      return this.event.available_seats <= 0;
    },

    formatDate(dateStr) {
      return new Date(dateStr).toLocaleDateString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });
    },

    formatTime(dateStr) {
      return new Date(dateStr).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    },

    formatDuration(minutes) {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      if (h === 0) return `${m} min`;
      if (m === 0) return `${h}h`;
      return `${h}h ${m}min`;
    },

    formatCents(cents) {
      return (cents / 100).toFixed(2).replace('.', ',') + ' €';
    },

    typeLabel(type) {
      switch (type) {
        case 'general': return 'Entrada';
        case 'group': return 'Pack';
        case 'donation': return 'Donación';
        case 'donation_custom': return 'Donación libre';
        default: return type;
      }
    },

    cartQty(ticketTypeId) {
      const item = Alpine.store('cart').items.find(i => i.ticketTypeId === ticketTypeId);
      return item ? item.quantity : 0;
    },

    addToCart(tt) {
      Alpine.store('cart').addItem(tt);
    },

    removeFromCart(ticketTypeId) {
      const cart = Alpine.store('cart');
      const item = cart.items.find(i => i.ticketTypeId === ticketTypeId);
      if (item && item.quantity > 1) {
        cart.updateQuantity(ticketTypeId, item.quantity - 1);
      } else {
        cart.removeItem(ticketTypeId);
      }
    },

    goToCheckout() {
      window.location.hash = '#/checkout';
    },

    goBack() {
      window.location.hash = '#/';
    }
  }));

  // ----------------------------------------------------------
  // CHECKOUT PAGE
  // ----------------------------------------------------------
  //
  // FIX: The original code set this.step = 'processing' BEFORE
  // calling stripe.confirmPayment(). Since Alpine's x-if removes
  // DOM nodes when the condition is false, the Stripe Payment
  // Element iframe was destroyed before Stripe could read from it.
  //
  // Solution: We keep step = 'payment' during the entire
  // confirmPayment flow. A separate 'submittingPayment' flag
  // drives a processing overlay that sits ON TOP of the payment
  // form (keeping the Stripe iframe alive underneath).
  //
  // Also: pass clientSecret directly to confirmPayment() instead
  // of relying on the Elements instance having it, per Stripe's
  // latest migration docs.
  // ----------------------------------------------------------
  Alpine.data('checkoutPage', () => ({
    step: 'review',        // 'review' | 'payment' — only these two now
    error: null,
    elements: null,        // Stripe Elements instance
    paymentElement: null,   // The Payment Element
    elementReady: false,
    clientSecret: null,
    creatingIntent: false,
    submittingPayment: false,

    init() {
      if (Alpine.store('cart').isEmpty) {
        window.location.hash = '#/';
      }
    },

    get cart() {
      return Alpine.store('cart');
    },

    formatCents(cents) {
      return (cents / 100).toFixed(2).replace('.', ',') + ' €';
    },

    itemSubtotal(item) {
      return item.priceCents * item.quantity;
    },

    updateQty(ticketTypeId, delta) {
      const item = this.cart.items.find(i => i.ticketTypeId === ticketTypeId);
      if (!item) return;
      const newQty = item.quantity + delta;
      if (newQty <= 0) {
        this.cart.removeItem(ticketTypeId);
        if (this.cart.isEmpty) window.location.hash = '#/';
      } else {
        this.cart.updateQuantity(ticketTypeId, newQty);
      }
    },

    removeItem(ticketTypeId) {
      this.cart.removeItem(ticketTypeId);
      if (this.cart.isEmpty) window.location.hash = '#/';
    },

    get formValid() {
      return this.cart?.buyerName?.trim().length >= 2
        && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.cart?.buyerEmail || '');
    },

    // Step 1 → Step 2: create PaymentIntent, mount element
    async proceedToPayment() {
      if (!this.formValid) {
        this.error = 'Por favor, completa nombre y email correctamente.';
        return;
      }
      this.error = null;
      this.creatingIntent = true;

      try {
        const items = this.cart.items.map(i => ({
          ticketTypeId: i.ticketTypeId,
          quantity: i.quantity,
        }));

        const data = await callEdgeFunction('create-payment-intent', {
          eventId: this.cart.eventId,
          items,
          buyerName: this.cart.buyerName.trim(),
          buyerEmail: this.cart.buyerEmail.trim(),
          buyerNationalId: this.cart.buyerNationalId.trim() || null,
        });

        console.log('✅ PaymentIntent created, clientSecret received');
        this.clientSecret = data.clientSecret;
        this.step = 'payment';

        // Wait for Alpine to render the payment step DOM, then mount
        this.$nextTick(() => this.mountPaymentElement());
      } catch (err) {
        this.error = err.message;
      } finally {
        this.creatingIntent = false;
      }
    },

    // Mount the Stripe Payment Element into #stripe-payment-element
    mountPaymentElement() {
      const stripe = getStripe();

      // Create the Elements group with the clientSecret.
      // This binds the Elements instance to this specific PaymentIntent.
      const elements = stripe.elements({
        clientSecret: this.clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            fontFamily: '"DM Sans", sans-serif',
            borderRadius: '8px',
            colorPrimary: '#1a5c3a',
          },
        },
      });

      this.elements = elements;

      // Create the Payment Element
      const paymentElement = elements.create('payment', {
        layout: 'tabs',
      });

      this.paymentElement = paymentElement;

      paymentElement.on('ready', () => {
        console.log('✅ Payment Element ready');
        this.elementReady = true;
      });

      paymentElement.on('loaderror', (event) => {
        console.error('❌ Payment Element load error:', event);
        this.error = 'Error al cargar el formulario de pago. Refresca la página.';
      });

      // Mount into the DOM container
      const container = document.getElementById('stripe-payment-element');
      if (!container) {
        console.error('❌ #stripe-payment-element container not found in DOM');
        this.error = 'Error interno: contenedor de pago no encontrado.';
        return;
      }

      paymentElement.mount('#stripe-payment-element');
      console.log('✅ Payment Element mounted');
    },

    // Submit payment — CRITICAL: do NOT change step or hide the payment form
    async submitPayment() {
      if (this.submittingPayment) return;
      this.error = null;
      this.submittingPayment = true;

      // ⚠️ DO NOT set this.step = 'processing' here!
      // The Payment Element must remain mounted in the DOM for
      // stripe.confirmPayment() to read data from its iframe.
      // We use submittingPayment to show a processing overlay instead.

      try {
        const stripe = getStripe();

        if (!this.elements) {
          throw new Error('El formulario de pago no está inicializado.');
        }

        if (!this.elementReady) {
          throw new Error('El formulario de pago aún no está listo. Espera un momento.');
        }

        // Step A: Submit the Elements to trigger validation
        // and collect any wallet/payment data.
        console.log('🔄 Calling elements.submit()...');
        const { error: submitError } = await this.elements.submit();
        if (submitError) {
          console.error('❌ elements.submit() error:', submitError);
          throw new Error(submitError.message || 'Error de validación del pago.');
        }
        console.log('✅ elements.submit() succeeded');

        // Step B: Confirm the payment.
        // Pass the Elements instance — the clientSecret is already
        // bound to it from stripe.elements({ clientSecret }).
        console.log('🔄 Calling stripe.confirmPayment()...');
        const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
          elements: this.elements,
          confirmParams: {
            return_url: window.location.origin + window.location.pathname + '#/confirmation',
            payment_method_data: {
              billing_details: {
                name: this.cart.buyerName.trim(),
                email: this.cart.buyerEmail.trim(),
              },
            },
          },
          redirect: 'if_required',
        });

        if (stripeError) {
          console.error('❌ stripe.confirmPayment() error:', stripeError);
          throw new Error(stripeError.message);
        }

        console.log('✅ Payment confirmed:', paymentIntent?.status);

        if (paymentIntent && paymentIntent.status === 'succeeded') {
          // Step C: Confirm with our backend (create order, tickets, PDF, email)
          console.log('🔄 Calling confirm-ticket edge function...');
          const result = await callEdgeFunction('confirm-ticket', {
            paymentIntentId: paymentIntent.id,
          });

          console.log('✅ Order created:', result.orderId);

          // Store for the confirmation page
          Alpine.store('cart')._lastOrder = {
            orderId: result.orderId,
            ticketIds: result.ticketIds,
            eventName: this.cart.eventName,
            buyerName: this.cart.buyerName,
            buyerEmail: this.cart.buyerEmail,
            items: [...this.cart.items],
            totalCents: this.cart.totalCents,
          };

          this.cart.clear();
          window.location.hash = '#/confirmation';
        } else if (paymentIntent && paymentIntent.status === 'requires_action') {
          // 3DS or other action required — Stripe handles this via redirect
          // If we get here with redirect: 'if_required', Stripe already handled it
          console.log('⏳ Payment requires additional action');
        } else {
          throw new Error('El pago no se completó. Estado: ' + (paymentIntent?.status || 'desconocido'));
        }

      } catch (err) {
        console.error('❌ Payment error:', err);
        this.error = err.message || 'Error al procesar el pago. Inténtalo de nuevo.';
      } finally {
        this.submittingPayment = false;
      }
    },

    goBackToReview() {
      // Destroy the Stripe elements cleanly
      if (this.paymentElement) {
        this.paymentElement.destroy();
        this.paymentElement = null;
      }
      this.elements = null;
      this.elementReady = false;
      this.clientSecret = null;
      this.error = null;
      this.step = 'review';
    },

    goBackToEvent() {
      window.location.hash = `#/events/${this.cart.eventSlug}`;
    }
  }));

  // ----------------------------------------------------------
  // CONFIRMATION PAGE
  // ----------------------------------------------------------
  Alpine.data('confirmationPage', () => ({
    order: null,

    init() {
      this.order = Alpine.store('cart')._lastOrder || null;
    },

    formatCents(cents) {
      return (cents / 100).toFixed(2).replace('.', ',') + ' €';
    },

    goHome() {
      window.location.hash = '#/';
    }
  }));

});
