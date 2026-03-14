const SUPABASE_URL = 'https://calxwytlgkoooyypscry.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_5nR7-p9o_ORS-qjrMxj4GA_RKm732Gn'; 
const SUPABASE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

// For the new sb_publishable format, we need to use the newer import method
const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

// Test Supabase connection
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

/**
 * Call a Supabase Edge Function (no auth for public endpoints).
 */
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

const STRIPE_PUBLISHABLE_KEY = 'pk_test_51SssZNP6Mg3f28KZzoWim4wZYHWJfKrSqyfXVRXsgDAC4pXFM7qw28HgszkDuCN9yP9751WUZ4v1lajWmyqSZY3800sgx3JuxA'; 

let stripeInstance = null;

function getStripe() {
  if (!stripeInstance) {
    stripeInstance = Stripe(STRIPE_PUBLISHABLE_KEY);
  }
  return stripeInstance;
}

document.addEventListener('alpine:init', () => {
  // Test Supabase connection on app initialization
  testSupabaseConnection();

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

      if (hash.match(/#\/events\/([a-f0-9-]+)/)) {
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

  // Events Page Component
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
      } catch (err) {
        Alpine.store('notify').error('Error al cargar eventos');
      } finally {
        this.loading = false;
      }
    },

    formatDate(dateStr) {
      const d = new Date(dateStr);
      return d.toLocaleDateString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });
    },

    formatTime(dateStr) {
      return new Date(dateStr).toLocaleTimeString('es-ES', {
        hour: '2-digit', minute: '2-digit'
      });
    },

    isAlmostFull(event) {
      return event.available_seats > 0 && event.available_seats <= Math.ceil(event.total_seats * 0.1);
    },

    isSoldOut(event) {
      return event.available_seats <= 0;
    },

    navigateTo(eventId) {
      window.location.hash = `#/events/${eventId}`;
    }
  }));

  // Event Detail Page Component
  Alpine.data('eventDetailPage', () => ({
    event: null,
    ticketTypes: [],
    loading: true,
    eventId: null,

    async init() {
      const match = window.location.hash.match(/#\/events\/([a-f0-9-]+)/);
      if (!match) { window.location.hash = '#/'; return; }
      this.eventId = match[1];
      await this.loadData();
    },

    async loadData() {
      this.loading = true;
      try {
        const [eventRes, typesRes] = await Promise.all([
          db.from('events').select('*').eq('id', this.eventId).single(),
          db.from('ticket_types').select('*')
            .eq('event_id', this.eventId)
            .eq('enabled', true)
            .order('sort_order'),
        ]);

        if (eventRes.error) throw eventRes.error;
        this.event = eventRes.data;
        this.ticketTypes = typesRes.data || [];

        Alpine.store('cart').setEvent(this.eventId, this.event.name);
      } catch (err) {
        Alpine.store('notify').error('Error al cargar el evento');
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
      return new Date(dateStr).toLocaleTimeString('es-ES', {
        hour: '2-digit', minute: '2-digit'
      });
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

  // Checkout Page Component
  Alpine.data('checkoutPage', () => ({
    step: 'review', // 'review' | 'payment' | 'processing'
    error: null,
    cardElement: null,
    paymentElement: null, // Add paymentElement reference
    elements: null, // Add elements reference
    elementReady: false, // Track element readiness
    elementError: null, // Track element errors
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
      return this.cart.buyerName.trim().length >= 2
        && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.cart.buyerEmail);
    },

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

console.log('Data (create-payment-intent):', data);

        this.clientSecret = data.clientSecret;
        this.step = 'payment';

        // Mount Stripe card element after DOM update
        this.$nextTick(() => this.mountCardElement());
      } catch (err) {
        this.error = err.message;
      } finally {
        this.creatingIntent = false;
      }
    },

    mountCardElement() {
      const stripe = getStripe();

      console.log('Mounting Payment Element with clientSecret:', this.clientSecret ? 'present' : 'missing');

      // Per official Stripe docs: pass clientSecret when creating the Elements instance
      // https://docs.stripe.com/payments/accept-a-payment?payment-ui=elements&api-integration=paymentintents
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

      // Create the Payment Element (NOT a card element)
      const paymentElement = elements.create('payment', { layout: 'tabs' });
      this.paymentElement = paymentElement; // Store reference like we did with cardElement

      paymentElement.on('ready', () => {
        console.log('✅ Payment Element ready');
        this.elementReady = true;
      });

      paymentElement.on('loaderror', (event) => {
        console.error('❌ Payment Element load error:', event);
        this.elementError = event.error?.message || 'Error loading payment form';
      });

      paymentElement.on('change', (event) => {
        console.log('Payment Element change:', event);
      });

      // Check if DOM element exists before mounting
      const container = document.getElementById('stripe-payment-element');
      if (!container) {
        console.error('❌ Container #stripe-payment-element not found');
        this.elementError = 'Payment form container not found';
        return;
      }

      paymentElement.mount('#stripe-payment-element');
      console.log('✅ Payment Element mounted');

      // Add timeout to detect if ready event fires
      setTimeout(() => {
        if (!this.elementReady && !this.elementError) {
          console.log('⚠️ Payment Element ready timeout - checking if element is in DOM');
          const element = document.getElementById('stripe-payment-element');
          if (element && element.children.length > 0) {
            console.log('✅ Element exists in DOM, forcing ready state');
            this.elementReady = true;
          } else {
            console.error('❌ Element not found in DOM after timeout');
            this.elementError = 'Payment form failed to load. Please refresh the page.';
          }
        }
      }, 5000); // 5 second timeout
    },

    async submitPayment() {
      if (this.submittingPayment) return;
      this.error = null;
      this.submittingPayment = true;
      this.step = 'processing';

      try {
        const stripe = getStripe();

        console.log('🔍 SubmitPayment debug:');
        console.log('- elements exists:', !!this.elements);
        console.log('- elementReady:', this.elementReady);
        console.log('- elementError:', this.elementError);
        console.log('- clientSecret:', this.clientSecret ? 'present' : 'missing');

        if (!this.elements) {
          throw new Error('Payment element not initialized');
        }

        // Check if Payment Element is actually in DOM
        const container = document.getElementById('stripe-payment-element');
        console.log('- container children:', container?.children.length || 0);

        if (!this.elementReady) {
          throw new Error('Payment element is not ready yet. Please wait a moment and try again.');
        }

        if (this.elementError) {
          throw new Error(`Payment element error: ${this.elementError}`);
        }

        console.log('✅ Confirming payment via stripe.confirmPayment()...');
        console.log('🔍 Elements object:', this.elements);
        console.log('🔍 Elements type:', typeof this.elements);

        // For Payment Elements, we need to submit the elements first to collect payment method data
        console.log('🔄 Submitting elements to collect payment data...');
        const { error: submitError } = await this.elements.submit();
        if (submitError) {
          console.error('❌ Elements submit error:', submitError);
          throw new Error(submitError.message || 'Payment form validation failed');
        }
        console.log('✅ Elements submitted successfully');

        // Now confirm the payment
        const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
          elements: this.elements,
          confirmParams: {
            return_url: window.location.origin + window.location.pathname + '#/confirmation',
          },
          redirect: 'if_required',
        });

        if (stripeError) {
          console.error('❌ Stripe payment error:', stripeError);
          this.error = stripeError.message;
          this.step = 'payment';
          this.submittingPayment = false;
          return;
        }

        console.log('✅ Payment succeeded:', paymentIntent);

        if (paymentIntent && paymentIntent.status === 'succeeded') {
          // Confirm with our backend
          const result = await callEdgeFunction('confirm-ticket', {
            paymentIntentId: paymentIntent.id,
          });

          // Store result for confirmation page
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
        }
      } catch (err) {
        console.error('❌ Payment submission error:', err);
        this.error = err.message || 'Payment failed. Please try again.';
        this.step = 'payment';
      } finally {
        this.submittingPayment = false;
      }
    },

    goBackToReview() {
      this.step = 'review';
      this.clientSecret = null;
      this.cardElement = null;
      this.paymentElement = null; // Clear paymentElement reference
      this.elements = null;
      this.elementReady = false;
      this.elementError = null;
      this.error = null;
    },

    goBackToEvent() {
      window.location.hash = `#/events/${this.cart.eventId}`;
    }
  }));

  // Confirmation Page Component
  Alpine.data('confirmationPage', () => ({
    order: null,

    init() {
      this.order = Alpine.store('cart')._lastOrder || null;
      if (!this.order) {
        // No order data — might be a redirect from Stripe
        // In production, parse payment_intent from URL and fetch order
      }
    },

    formatCents(cents) {
      return (cents / 100).toFixed(2).replace('.', ',') + ' €';
    },

    goHome() {
      window.location.hash = '#/';
    }
  }));

});
