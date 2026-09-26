"use client";

let loader = null;

function loadScript() {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  if (window.Razorpay) return Promise.resolve();
  if (!loader) {
    loader = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        loader = null;
        reject(new Error("Could not load the payment window. Check your connection and try again."));
      };
      document.body.appendChild(s);
    });
  }
  return loader;
}

/**
 * Opens Razorpay Checkout for an order created on the server.
 * Resolves with { razorpay_order_id, razorpay_payment_id, razorpay_signature }.
 * Rejects with { cancelled: true } when the user closes the window.
 */
export async function openRazorpay(order) {
  await loadScript();
  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: order.name,
      description: order.description,
      prefill: order.prefill,
      theme: { color: "#F53236" },
      retry: { enabled: true, max_count: 3 },
      handler: (resp) => resolve(resp),
      modal: {
        confirm_close: true,
        ondismiss: () => reject(Object.assign(new Error("Payment cancelled."), { cancelled: true })),
      },
    });
    rzp.on("payment.failed", (resp) => {
      reject(new Error(resp?.error?.description || "Payment failed. No money was taken - please try again."));
    });
    rzp.open();
  });
}
