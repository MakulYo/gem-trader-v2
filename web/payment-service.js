// web/payment-service.js
// Payment Service für TSDM-Zahlungen über WAX Blockchain

class PaymentService {
    constructor() {
        this.apiBase = window.backendService?.apiBase || '';
        this.session = null;
        this.pollingIntervals = new Map();
    }

    /**
     * Setze die aktuelle WharfKit Session
     * @param {Object} session - WharfKit Session
     */
    setSession(session) {
        this.session = session;
    }

    /**
     * Erstelle einen Payment-Request
     * @param {string} type - Payment-Typ (mining_slot_unlock, polishing_slot_unlock, mining_start)
     * @param {number} amount - TSDM-Betrag
     * @param {Object} metadata - Zusätzliche Metadaten
     * @returns {Promise<Object>} Payment-Request-Daten
     */
    async createPaymentRequest(type, amount, metadata = {}) {
        try {
            console.log('[PaymentService] Creating payment request:', { type, amount, metadata });
            
            const response = await fetch(`${this.apiBase}/createPaymentRequest`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    actor: this.session?.actor?.toString(),
                    type,
                    amount,
                    metadata
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create payment request');
            }

            const data = await response.json();
            console.log('[PaymentService] Payment request created:', data);
            return data;
        } catch (error) {
            console.error('[PaymentService] Error creating payment request:', error);
            throw error;
        }
    }

    /**
     * Führe die Blockchain-Zahlung aus
     * @param {string} paymentId - Payment-ID
     * @param {string} destination - Ziel-Adresse
     * @param {number} amount - TSDM-Betrag
     * @param {string} memo - Memo für die Transaktion
     * @returns {Promise<Object>} Transaktions-Ergebnis
     */
    async executePayment(paymentId, destination, amount, memo) {
        if (!this.session) {
            throw new Error('No wallet session available');
        }

        try {
            console.log('[PaymentService] Executing payment:', { paymentId, destination, amount, memo });

            const actor = this.session.actor.toString();
            
            // Erstelle Transfer-Action für WAX Blockchain
            const action = {
                account: 'lucas3333555', // TSDM_CONTRACT
                name: 'transfer',
                authorization: [{
                    actor: actor,
                    permission: this.session.permission.toString()
                }],
                data: {
                    from: actor,
                    to: destination,
                    quantity: `${amount.toFixed(4)} TSDM`,
                    memo: memo
                }
            };

            // Nutze die Session für die Transaktion
            // WharfKit zeigt automatisch die Signatur-Anfrage in der verbundenen Wallet an
            const result = await this.session.transact({ action });

            console.log('[PaymentService] Payment transaction completed:', result);
            return result;
        } catch (error) {
            console.error('[PaymentService] Error executing payment:', error);
            throw error;
        }
    }

    /**
     * Verifiziere eine Zahlung
     * @param {string} paymentId - Payment-ID
     * @returns {Promise<Object>} Verifikations-Ergebnis
     */
    async verifyPayment(paymentId) {
        try {
            console.log('[PaymentService] Verifying payment:', paymentId);
            
            const response = await fetch(`${this.apiBase}/verifyPayment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    actor: this.session?.actor?.toString(),
                    paymentId
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to verify payment');
            }

            const data = await response.json();
            console.log('[PaymentService] Payment verification result:', data);
            return data;
        } catch (error) {
            console.error('[PaymentService] Error verifying payment:', error);
            throw error;
        }
    }

    /**
     * Hole alle ausstehenden Zahlungen
     * @returns {Promise<Array>} Liste der ausstehenden Zahlungen
     */
    async getPendingPayments() {
        try {
            console.log('[PaymentService] Getting pending payments');
            
            const response = await fetch(`${this.apiBase}/getPendingPayments?actor=${this.session?.actor?.toString()}`);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to get pending payments');
            }

            const data = await response.json();
            console.log('[PaymentService] Pending payments:', data);
            return data.payments || [];
        } catch (error) {
            console.error('[PaymentService] Error getting pending payments:', error);
            throw error;
        }
    }

    /**
     * Storniere eine Zahlung
     * @param {string} paymentId - Payment-ID
     * @returns {Promise<Object>} Stornierungs-Ergebnis
     */
    async cancelPayment(paymentId) {
        try {
            console.log('[PaymentService] Cancelling payment:', paymentId);
            
            const response = await fetch(`${this.apiBase}/cancelPayment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    actor: this.session?.actor?.toString(),
                    paymentId
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to cancel payment');
            }

            const data = await response.json();
            console.log('[PaymentService] Payment cancelled:', data);
            return data;
        } catch (error) {
            console.error('[PaymentService] Error cancelling payment:', error);
            throw error;
        }
    }

    /**
     * Starte Polling für Payment-Status
     * @param {string} paymentId - Payment-ID
     * @param {Function} onStatusChange - Callback für Status-Änderungen
     * @param {number} intervalMs - Polling-Intervall in Millisekunden
     */
    startPolling(paymentId, onStatusChange, intervalMs = 5000) {
        if (this.pollingIntervals.has(paymentId)) {
            console.warn('[PaymentService] Polling already active for payment:', paymentId);
            return;
        }

        console.log('[PaymentService] Starting polling for payment:', paymentId);
        
        const interval = setInterval(async () => {
            try {
                const result = await this.verifyPayment(paymentId);
                onStatusChange(result);
                
                // Stoppe Polling wenn Zahlung abgeschlossen oder fehlgeschlagen ist
                if (result.verified || result.status === 'failed' || result.status === 'timeout') {
                    this.stopPolling(paymentId);
                }
            } catch (error) {
                console.error('[PaymentService] Polling error:', error);
                onStatusChange({ error: error.message });
            }
        }, intervalMs);

        this.pollingIntervals.set(paymentId, interval);
    }

    /**
     * Stoppe Polling für Payment-Status
     * @param {string} paymentId - Payment-ID
     */
    stopPolling(paymentId) {
        const interval = this.pollingIntervals.get(paymentId);
        if (interval) {
            console.log('[PaymentService] Stopping polling for payment:', paymentId);
            clearInterval(interval);
            this.pollingIntervals.delete(paymentId);
        }
    }

    /**
     * Vollständiger Payment-Flow: Request erstellen, Zahlung ausführen, verifizieren
     * @param {string} type - Payment-Typ
     * @param {number} amount - TSDM-Betrag
     * @param {Object} metadata - Metadaten
     * @param {Function} onProgress - Progress-Callback
     * @returns {Promise<Object>} Payment-Ergebnis
     */
    async processPayment(type, amount, metadata = {}, onProgress = null) {
        try {
            // 1. Payment-Request erstellen
            if (onProgress) onProgress('Creating payment request...');
            const request = await this.createPaymentRequest(type, amount, metadata);
            
            // 2. Blockchain-Zahlung ausführen
            if (onProgress) onProgress('Executing blockchain payment...');
            const txResult = await this.executePayment(
                request.paymentId,
                request.payment.destination,
                request.payment.amount,
                request.payment.memo
            );

            // 3. Zahlung verifizieren
            if (onProgress) onProgress('Verifying payment...');
            
            // Nur im lokalen Entwicklungsmodus Mock-Verifikation verwenden
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            
            if (isLocalhost) {
                console.log('[PaymentService] Localhost detected - using mock verification');
                // Mock-Verifikation für lokalen Emulator
                await new Promise(resolve => setTimeout(resolve, 1000)); // 1 Sekunde warten
                
                if (onProgress) onProgress('Payment completed successfully! (Mock)');
                return {
                    success: true,
                    paymentId: request.paymentId,
                    txId: 'mock-tx-' + Date.now(),
                    blockTime: new Date().toISOString(),
                    mock: true
                };
            } else {
                // Echte Blockchain-Verifikation für Produktion
                // Mit Retry-Logik, da Transaktionen einige Sekunden brauchen können
                const maxRetries = 10;
                const retryDelay = 3000; // 3 Sekunden
                
                for (let attempt = 1; attempt <= maxRetries; attempt++) {
                    if (onProgress) onProgress(`Verifying payment (attempt ${attempt}/${maxRetries})...`);
                    
                    const verification = await this.verifyPayment(request.paymentId);

                    if (verification.verified) {
                        if (onProgress) onProgress('Payment completed successfully!');
                        return {
                            success: true,
                            paymentId: request.paymentId,
                            txId: verification.txId,
                            blockTime: verification.blockTime
                        };
                    }
                    
                    // Warten vor nächstem Versuch (außer beim letzten)
                    if (attempt < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                    }
                }
                
                throw new Error('Payment verification failed after multiple attempts');
            }
        } catch (error) {
            console.error('[PaymentService] Payment process failed:', error);
            if (onProgress) onProgress(`Payment failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Hole Payment-Typen und deren Beschreibungen
     * @returns {Object} Payment-Typen
     */
    getPaymentTypes() {
        return {
            mining_slot_unlock: {
                name: 'Mining Slot Unlock',
                description: 'Unlock additional mining slot'
            },
            polishing_slot_unlock: {
                name: 'Polishing Slot Unlock',
                description: 'Unlock additional polishing slot'
            },
            mining_start: {
                name: 'Mining Start',
                description: 'Start mining operation'
            }
        };
    }
}

// Globale Instanz erstellen
window.paymentService = new PaymentService();

// Session-Synchronisation mit Wallet
window.addEventListener('wallet-connected', (event) => {
    console.log('[PaymentService] Wallet connected, updating session');
    window.paymentService.setSession(event.detail.session);
});

window.addEventListener('wallet-session-restored', (event) => {
    console.log('[PaymentService] Wallet session restored, updating session');
    window.paymentService.setSession(event.detail.session);
});

window.addEventListener('wallet-disconnected', () => {
    console.log('[PaymentService] Wallet disconnected, clearing session');
    window.paymentService.setSession(null);
});

console.log('[PaymentService] Payment service initialized');
