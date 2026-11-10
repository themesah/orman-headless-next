import * as react from 'react';
import { ApiOptions } from './csrf.js';
import { CargoProductBlock, CargoSite, CartData } from './types.js';

/** Minor units as text: 5000 GBP → "£50.00". Rial and other zero-decimal currencies keep their own digits through Intl. */
declare function formatMoney(amount: number | null, currency: string | null, locale?: string): string;
interface AddToCartLabels {
    add: string;
    adding: string;
    added: string;
    outOfStock: string;
    chooseOption: string;
}
declare const DEFAULT_ADD_TO_CART_LABELS: AddToCartLabels;
interface AddToCartProps {
    /** The product's id (`page.id`). */
    productId: string;
    /** `addons.cargo` of the product page. */
    product: CargoProductBlock;
    /** `addons.cargo` of the cached `/site`. Default addresses are used when omitted. */
    site?: Pick<CargoSite, 'line_items'>;
    quantity?: number;
    labels?: Partial<AddToCartLabels>;
    api?: ApiOptions;
    /** Called with the cart after the line was added (open a drawer, update a badge). */
    onAdded?: (cart: CartData | null) => void;
    className?: string;
}
/**
 * The add button of a product: a variant select when the product has variants, the button, the answer. Out of stock renders a disabled
 * button, not nothing. Per-person: the cart is a cookie, nothing is cached. Class hooks `orman-addtocart`, `__variant`, `__button`,
 * `__error` (role="alert").
 */
declare function AddToCart({ productId, product, site, quantity, labels, api: apiOptions, onAdded, className }: AddToCartProps): react.JSX.Element;
interface CartLabels {
    title: string;
    empty: string;
    remove: string;
    quantity: string;
    subtotal: string;
    total: string;
    checkout: string;
}
declare const DEFAULT_CART_LABELS: CartLabels;
interface CartProps {
    site?: Pick<CargoSite, 'cart' | 'line_items'>;
    labels?: Partial<CartLabels>;
    api?: ApiOptions;
    /** Shown under the totals; usually a link to the checkout page. When omitted no checkout control is rendered. */
    checkoutHref?: string;
    onChange?: (cart: CartData | null) => void;
    className?: string;
}
/**
 * The person's cart: lines with a quantity and a remove button, the totals Cargo calculated (formatted by the site's currency; the kit
 * does no arithmetic). A guest with no cart yet sees the empty state, not an error. Class hooks `orman-cart`, `__line`, `__title`,
 * `__quantity`, `__remove`, `__total`, `__checkout`, `__empty`.
 */
declare function Cart({ site, labels, api: apiOptions, checkoutHref, onChange, className }: CartProps): react.JSX.Element;
interface CheckoutLabels {
    gateway: string;
    pay: string;
    paying: string;
}
declare const DEFAULT_CHECKOUT_LABELS: CheckoutLabels;
interface CheckoutProps {
    site: Pick<CargoSite, 'checkout' | 'gateways'>;
    labels?: Partial<CheckoutLabels>;
    api?: ApiOptions;
    /** Called with the address to go to (`confirmation_url`). Default: `location.assign`. */
    onPlaced?: (confirmationUrl: string) => void;
    className?: string;
}
/**
 * The last step: pick a gateway, place the order. A gateway that takes the money on the spot (or a free cart) answers an order, and the
 * person is sent to the site's confirmation page; Cargo's refusals (no address, no stock) arrive as `422 {errors}` and are shown as they
 * are. A gateway that leaves for the bank's page is the site's own button (`payment-gateways` gives its `checkout_url`): the bank sends
 * the person back through the proxy, and Orman ends on the confirmation page. Class hooks `orman-checkout`, `__gateway`, `__submit`,
 * `__error` (role="alert").
 */
declare function Checkout({ site, labels, api: apiOptions, onPlaced, className }: CheckoutProps): react.JSX.Element;
interface OrderConfirmationProps {
    site?: Pick<CargoSite, 'order'>;
    /** `searchParams` of the confirmation page: `order`, `expires`, `signature`. */
    query: {
        order?: string;
        expires?: string;
        signature?: string;
    };
    labels?: Partial<{
        title: string;
        number: string;
        total: string;
        invalid: string;
    }>;
    api?: ApiOptions;
    className?: string;
}
/** The confirmation page's body: the order behind the signed query the checkout put in the address. Class hooks `orman-order`, `__line`, `__total`, `__error`. */
declare function OrderConfirmation({ site, query, labels, api: apiOptions, className }: OrderConfirmationProps): react.JSX.Element;

export { AddToCart, type AddToCartLabels, type AddToCartProps, Cart, type CartLabels, type CartProps, Checkout, type CheckoutLabels, type CheckoutProps, DEFAULT_ADD_TO_CART_LABELS, DEFAULT_CART_LABELS, DEFAULT_CHECKOUT_LABELS, OrderConfirmation, type OrderConfirmationProps, formatMoney };
