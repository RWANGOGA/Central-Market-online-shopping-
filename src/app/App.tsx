import React, { useState, useMemo, useEffect, useRef } from 'react';
import imgRectangle6538 from "figma:asset/39a095c5219433210528f313f4db7ed09e8b6466.png";
import imgRectangle6539 from "figma:asset/c7319cef2b86a8f71b6765b77a10caccb7fc8b83.png";
import imgRectangle6540 from "figma:asset/1b41f753535d961cfbba08b0eb03a1902c09f7f3.png";
import imgRectangle6541 from "figma:asset/07e73d3701b2c2cf9a8054b1b2606088545c1b53.png";
import imgRectangle6542 from "figma:asset/345d9f75120e49e4b6f691447bccd48abfb67431.png";
import imgRectangle6543 from "figma:asset/28818bcf637e7596ffec2602b44c1b407fe11cf9.png";
import imgRectangle6544 from "figma:asset/d55ecea918fdfbe2d236a4386a73a981bf45f319.png";
import imgRectangle6545 from "figma:asset/464f20b81f02057b5cc69adbc19fb20af709c271.png";
import imgRectangle6546 from "figma:asset/365c8fc0f53d1bc2bad0988227099e87b4730cbc.png";
import imgRectangle6547 from "figma:asset/f286a5e73a18e796afd61d7b68c51addff2c69b6.png";

// Import all page components
import ProductListPage from './components/ProductListPage';
import ProductDetailPage from './components/ProductDetailPage';
import BasketPage from './components/BasketPage';
import CheckoutPage from './components/CheckoutPage';
import PaymentPage from './components/PaymentPage';
import ConfirmationPage from './components/ConfirmationPage';
import OrderConfirmationPage from './components/OrderConfirmationPage';
import NewsstandPage from './components/NewsstandPage';
import AboutPage from './components/AboutPage';
import ProfilePage from './components/ProfilePage';
import LoginPage from './components/LoginPage';
import SignupPage from './components/SignupPage';
import AddToCartOverlay from './components/AddToCartOverlay';
import Menu from './components/Menu';
import MapPage from './components/MapPage';
import AdminPage from './components/AdminPage';
import { resolveCartId, addItem as apiAddItem, updateItem, fetchCart, resetCart } from './lib/cartApi';
import { fetchStock, applyStockDelta, type StockLevel } from './lib/stockApi';
import { useCatalogue, type CatalogueProduct } from './lib/catalogue';
import { fetchCustomerProfile, createOrder } from './lib/customerApi';

// Enhanced product data with descriptions and locations
/**
 * The compiled-in catalogue. Used as the shop's fallback when the API cannot be
 * reached, and as the source an admin's additions are merged into. The live
 * catalogue comes from /api/products so an admin can add products at runtime.
 */
const FALLBACK_CATALOGUE: CatalogueProduct[] = [
  {
    id: 1,
    name: "Garlic clove",
    price: "USh 3,524 each",
    priceValue: 3524,
    stock: 120,
    unit: 'each',
    farm: "Bukalasi Farm",
    images: [imgRectangle6538, imgRectangle6539],
    isFavorite: false,
    description: "Bold, aromatic garlic cloves with a rich, complex flavor. Perfect for roasting, sautéing, or adding depth to any dish.",
    location: "Grown in Sironko District by Bukalasi Farm",
    dietary: ["VG", "GF", "DF"]
  },
  {
    id: 2,
    name: "Sugar snap pea",
    price: "USh 19,992/kg",
    priceValue: 19992,
    stock: 36,
    unit: 'kg',
    farm: "Rwambari Farm",
    images: [imgRectangle6540, imgRectangle6539],
    isFavorite: false,
    description: "Crisp, sweet sugar snap peas with edible pods. Enjoy raw as a snack or lightly steamed to preserve their natural crunch.",
    location: "Grown in Kyegegwa District by Rwambari Farm",
    dietary: ["VG", "GF", "DF"]
  },
  {
    id: 3,
    name: "Ginger",
    price: "USh 36,667/kg",
    priceValue: 36667,
    stock: 27,
    unit: 'kg',
    farm: "Bungokho Farm",
    images: [imgRectangle6541],
    isFavorite: false,
    description: "Fresh, organic ginger root with a warm, spicy kick. Essential for Asian cooking and natural wellness remedies.",
    location: "Grown in Mbale District by Bungokho Farm",
    dietary: ["VG", "GF", "DF"]
  },
  {
    id: 4,
    name: "Sweet onion",
    price: "USh 3,404/kg",
    priceValue: 3404,
    stock: 91,
    unit: 'kg',
    farm: "Kyarakora Farm",
    images: [imgRectangle6542],
    isFavorite: false,
    description: "Mild, sweet onions perfect for caramelizing or eating raw. Low in sulfur with a delicate, pleasant flavor.",
    location: "Grown in Kabale District by Kyarakora Farm",
    dietary: ["VG", "GF", "DF"]
  },
  {
    id: 5,
    name: "Raspberries",
    price: "USh 15,800 pint",
    priceValue: 15800,
    stock: 45,
    unit: 'pint',
    farm: "Ngarama Farm",
    images: [imgRectangle6543],
    isFavorite: false,
    description: "Juicy, sweet-tart raspberries bursting with flavor. Rich in antioxidants and perfect for snacking or desserts.",
    location: "Grown in Mbarara District by Ngarama Farm",
    dietary: ["VG", "GF", "DF"]
  },
  {
    id: 6,
    name: "Bananas",
    price: "USh 5,587/kg",
    priceValue: 5587,
    stock: 136,
    unit: 'kg',
    farm: "Rwekubo Farm",
    images: [imgRectangle6544],
    isFavorite: false,
    description: "Sweet, creamy bananas perfect for smoothies, baking, or eating fresh. A great source of potassium and natural energy.",
    location: "Grown in Isingiro District by Rwekubo Farm",
    dietary: ["VG", "GF", "DF"]
  },
  {
    id: 7,
    name: "Avocados",
    price: "USh 4,158 each",
    priceValue: 4158,
    stock: 90,
    unit: 'each',
    farm: "Najjera Farm",
    images: [imgRectangle6545],
    isFavorite: false,
    description: "Creamy, buttery avocados rich in healthy fats. Perfect for guacamole, toast, or adding to salads and smoothies.",
    location: "Grown in Wakiso District by Najjera Farm",
    dietary: ["VG", "GF", "DF"]
  },
  {
    id: 8,
    name: "Kale",
    price: "USh 7,880 each",
    priceValue: 7880,
    stock: 75,
    unit: 'each',
    farm: "Kawolo Farm",
    images: [imgRectangle6546],
    isFavorite: false,
    description: "Nutrient-dense kale with a robust, earthy flavor. Excellent for salads, smoothies, or crispy kale chips.",
    location: "Grown in Mityana District by Kawolo Farm",
    dietary: ["VG", "GF", "DF"]
  },
  {
    id: 9,
    name: "Radish",
    price: "USh 5,108 each",
    priceValue: 5108,
    stock: 110,
    unit: 'each',
    farm: "Nkolokoto Farm",
    images: [imgRectangle6547],
    isFavorite: false,
    description: "Crisp, peppery radishes with a fresh, clean bite. Great for salads, pickling, or as a crunchy snack.",
    location: "Grown in Mpigi District by Nkolokoto Farm",
    dietary: ["VG", "GF", "DF"]
  }
];

/** How often the catalogue re-reads stock from the inventory service. */
const STOCK_POLL_MS = 30_000;

type SortOption = 'default' | 'a-z' | 'price';
type ViewMode = 'list' | 'detail' | 'basket' | 'checkout' | 'payment' | 'confirmation' | 'orderConfirmation' | 'newsstand' | 'about' | 'profile' | 'map' | 'admin' | 'login' | 'signup';

interface CartItem {
  id: number;
  name: string;
  price: string;
  priceValue: number;
  image: string;
  quantity: number;
  unit: string;
}

interface OverlayProduct {
  id: number;
  name: string;
  image: string;
}

interface CustomerInfo {
  fullName: string;
  phone: string;
  region: string;
  district: string;
  subCounty: string;
  parish: string;
  village: string;
  address: string;
}

interface CustomerSession {
  id: number;
  fullName: string;
  phone: string;
  email?: string;
  region: string;
  district?: string;
  subCounty?: string;
  parish?: string;
  village?: string;
  address: string;
}

/**
 * Cart lines are always built from the local catalogue, whether they arrive
 * from a tap or from the API on reload, so the basket always renders with the
 * same name, price and image as the product list.
 */
function buildCartItem(product: CatalogueProduct, quantity: number): CartItem {
  return {
    id: product.id,
    name: product.name,
    price: product.price,
    priceValue: product.priceValue,
    image: product.images[0],
    quantity,
    unit: product.unit,
  };
}

export default function App() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('default');
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedProduct, setSelectedProduct] = useState<CatalogueProduct | null>(null);

  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    fullName: '',
    phone: '',
    region: '',
    district: '',
    subCounty: '',
    parish: '',
    village: '',
    address: ''
  });

  const [customerSession, setCustomerSession] = useState<CustomerSession | null>(null);

  // Add to cart overlay state
  const [showOverlay, setShowOverlay] = useState(false);
  const [overlayProduct, setOverlayProduct] = useState<OverlayProduct | null>(null);
  const [overlayQuantity, setOverlayQuantity] = useState(1);

  // Server cart. Null means the API is not running and the cart stays local.
  const cartIdRef = useRef<number | null>(null);

  // Live stock, keyed by product id. Empty means the inventory service has not
  // answered yet or is unreachable, and the UI says which.
  const [stockLevels, setStockLevels] = useState<Map<number, StockLevel>>(new Map());
  const [stockLive, setStockLive] = useState(false);

  // The shop reads the catalogue from the API so an admin's additions appear.
  // FALLBACK_CATALOGUE keeps the seeded nine on screen if the API is down.
  const { products, live: catalogueLive, refresh: refreshCatalogue } = useCatalogue(FALLBACK_CATALOGUE);

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  // Poll stock so the figures stay current without a manual refresh. A buyer
  // planning an order needs this to be live, not a number frozen at build time.
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const result = await fetchStock();
      if (cancelled) return;
      if (result) {
        setStockLevels(result.levels);
        setStockLive(true);
      }
    };

    load();
    const timer = window.setInterval(load, STOCK_POLL_MS);

    // Re-check when the tab comes back, since a backgrounded tab stops timers
    // and the figures would otherwise be stale on return.
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Restore the cart on load so a refresh does not empty the basket.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const cartId = await resolveCartId();
      if (cancelled) return;

      if (!cartId) return; // API not running, cart stays local-only
      cartIdRef.current = cartId;

      const cart = await fetchCart(cartId);
      if (cancelled || !cart) return;

      // Rebuild items from the local catalogue so names, prices and images
      // stay identical to the rest of the app. Server-only products are
      // skipped rather than rendered half-populated.
      const restored = cart.items.flatMap((line) => {
        const product = products.find((p) => p.id === line.productId);
        return product ? [buildCartItem(product, line.quantity)] : [];
      });

      setCartItems(restored);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredAndSortedProducts = useMemo(() => {
    let filtered = products.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    switch (sortOption) {
      case 'a-z':
        return filtered.sort((a, b) => a.name.localeCompare(b.name));
      case 'price':
        return filtered.sort((a, b) => a.priceValue - b.priceValue);
      default:
        return filtered;
    }
  }, [searchTerm, sortOption, products]);

  const toggleFavorite = (productId: number) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(productId)) {
      newFavorites.delete(productId);
    } else {
      newFavorites.add(productId);
    }
    setFavorites(newFavorites);
  };

  const showAddToCartOverlay = (product: CatalogueProduct, quantity = 1) => {
    setOverlayProduct({
      id: product.id,
      name: product.name,
      image: product.images[0]
    });
    setOverlayQuantity(quantity);
    setShowOverlay(true);

    // Hide overlay after 1 second
    setTimeout(() => {
      setShowOverlay(false);
    }, 1000);
  };

  const addToCart = (productId?: number, quantityToAdd = 1) => {
    let targetProduct;
    
    if (productId) {
      targetProduct = products.find(p => p.id === productId);
    } else if (selectedProduct) {
      targetProduct = selectedProduct;
    }
    
    if (!targetProduct) return;

    // Show overlay
    showAddToCartOverlay(targetProduct, quantityToAdd);

    setCartItems(prevItems => {
      const existingItem = prevItems.find(item => item.id === targetProduct.id);

      if (existingItem) {
        return prevItems.map(item =>
          item.id === targetProduct.id
            ? { ...item, quantity: item.quantity + quantityToAdd }
            : item
        );
      } else {
        return [...prevItems, buildCartItem(targetProduct, quantityToAdd)];
      }
    });

    // Sync to the API. The local update above already happened, so a failure
    // here degrades to an unsynced cart rather than a broken interaction.
    const serverCartId = cartIdRef.current;
    if (serverCartId) {
      apiAddItem(serverCartId, targetProduct.id, quantityToAdd);
    } else {
      resolveCartId().then((id) => {
        cartIdRef.current = id;
        if (id) apiAddItem(id, targetProduct.id, quantityToAdd);
      });
    }
  };

  const updateCartItemQuantity = (productId: number, quantity: number) => {
    if (quantity === 0) {
      setCartItems(prevItems => prevItems.filter(item => item.id !== productId));
    } else {
      setCartItems(prevItems =>
        prevItems.map(item =>
          item.id === productId
            ? { ...item, quantity }
            : item
        )
      );
    }

    const serverCartId = cartIdRef.current;
    if (serverCartId) {
      updateItem(serverCartId, productId, quantity);
    }
  };

  // Navigation handlers
  const handleProductClick = (product: CatalogueProduct) => {
    setSelectedProduct(product);
    setViewMode('detail');
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedProduct(null);
  };

  const handleCartClick = () => {
    setViewMode('basket');
  };

  const handleBackFromBasket = () => {
    setViewMode('list');
  };

  const handleGoToCheckout = () => {
    setViewMode('checkout');
  };

  const handleBackFromCheckout = () => {
    setViewMode('basket');
  };

  const handleProceedToPayment = (customerData: CustomerInfo) => {
    setCustomerInfo(customerData);
    setViewMode('payment');
  };

  const handleBackFromPayment = () => {
    setViewMode('checkout');
  };

  const handleProceedToConfirmation = () => {
    setViewMode('confirmation');
  };

  const handleBackFromConfirmation = () => {
    setViewMode('payment');
  };

  const handleCompletePurchase = async () => {
    const serverCartId = cartIdRef.current;
    if (serverCartId && cartItems.length > 0) {
      let customerId = customerSession?.id;

      if (!customerId) {
        try {
          const guest = await createGuestCustomer({
            fullName: customerInfo.fullName.trim() || 'Guest',
            phone: customerInfo.phone.trim(),
            region: customerInfo.region || 'Central Region',
            district: customerInfo.district || undefined,
            address: customerInfo.address.trim() || 'Not specified',
          });
          customerId = guest.id;
        } catch {
          // Proceed without linking to a customer record if guest creation fails
          customerId = undefined;
        }
      }

      if (customerId) {
        try {
          await createOrder(serverCartId, customerId);
        } catch {
          // Don't block the confirmation screen if the order write fails
        }
      }
    }

    // Show order confirmation and clear cart
    setViewMode('orderConfirmation');

    // Reflect the sale immediately rather than waiting for the next poll, so
    // the basket and the stock figures agree on screen straight away.
    setStockLevels((current) => {
      let next = current;
      for (const item of cartItems) {
        next = applyStockDelta(next, item.id, item.quantity);
      }
      return next;
    });

    setCartItems([]);

    // Empty the server cart and start a fresh one, so a reload after
    // checkout does not resurrect the basket that was just paid for.
    if (serverCartId) {
      resetCart(serverCartId).then((id) => {
        cartIdRef.current = id;
      });
    }
  };

  const handleShopFromOrderConfirmation = () => {
    setViewMode('list');
    setSelectedProduct(null);
    setCustomerInfo({
      fullName: '',
      phone: '',
      region: '',
      district: '',
      subCounty: '',
      parish: '',
      village: '',
      address: ''
    });
  };

  const handleMenuNavigation = (screen: string) => {
    if (screen === 'profile' && !customerSession) {
      setViewMode('login');
      return;
    }
    setViewMode(screen as ViewMode);
    setSelectedProduct(null);
  };

  const handleLoginSuccess = (customer: CustomerSession) => {
    setCustomerSession(customer);
    setCustomerInfo({
      fullName: customer.fullName,
      phone: customer.phone,
      region: customer.region,
      district: customer.district || '',
      subCounty: customer.subCounty || '',
      parish: customer.parish || '',
      village: customer.village || '',
      address: customer.address,
    });
    setViewMode('profile');
  };

  const handleSignupSuccess = (customer: CustomerSession) => {
    setCustomerSession(customer);
    setCustomerInfo({
      fullName: customer.fullName,
      phone: customer.phone,
      region: customer.region,
      district: customer.district || '',
      subCounty: customer.subCounty || '',
      parish: customer.parish || '',
      village: customer.village || '',
      address: customer.address,
    });
    setViewMode('profile');
  };

  const handleLogout = () => {
    setCustomerSession(null);
    setCustomerInfo({
      fullName: '',
      phone: '',
      region: '',
      district: '',
      subCounty: '',
      parish: '',
      village: '',
      address: ''
    });
    setViewMode('list');
  };

  // Render current view based on viewMode
  const renderCurrentView = () => {
    switch (viewMode) {
      case 'list':
        return (
          <ProductListPage
            products={filteredAndSortedProducts}
            favorites={favorites}
            searchTerm={searchTerm}
            sortOption={sortOption}
            cartCount={cartCount}
            onSearchChange={setSearchTerm}
            onSortChange={setSortOption}
            onToggleFavorite={toggleFavorite}
            onAddToCart={(productId) => addToCart(productId, 1)}
            onProductClick={handleProductClick}
            onMenuClick={() => setIsNavOpen(true)}
            onCartClick={handleCartClick}
            stockLevels={stockLevels}
            stockLive={stockLive}
          />
        );
      
      case 'detail':
        return selectedProduct ? (
          <ProductDetailPage
            product={selectedProduct}
            cartCount={cartCount}
            stockLevel={stockLevels.get(selectedProduct.id) ?? null}
            stockLive={stockLive}
            onBack={handleBackToList}
            onAddToCart={(quantity) => addToCart(undefined, quantity)}
            onMenuClick={() => setIsNavOpen(true)}
            onCartClick={handleCartClick}
          />
        ) : null;
      
      case 'basket':
        return (
          <BasketPage
            cartItems={cartItems}
            onBack={handleBackFromBasket}
            onMenuClick={() => setIsNavOpen(true)}
            onUpdateQuantity={updateCartItemQuantity}
            onGoToCheckout={handleGoToCheckout}
          />
        );
      
      case 'checkout':
        return (
          <CheckoutPage
            cartCount={cartCount}
            customerInfo={customerInfo}
            onBack={handleBackFromCheckout}
            onMenuClick={() => setIsNavOpen(true)}
            onProceedToPayment={handleProceedToPayment}
          />
        );
      
      case 'payment':
        return (
          <PaymentPage
            cartCount={cartCount}
            cartId={cartIdRef.current}
            customerName={customerInfo.fullName}
            onBack={handleBackFromPayment}
            onMenuClick={() => setIsNavOpen(true)}
            onProceedToConfirmation={handleProceedToConfirmation}
          />
        );

      case 'admin':
        return <AdminPage onClose={() => setViewMode('list')} />;

      case 'map':
        return (
          <MapPage
            cartCount={cartCount}
            initialDistrict={customerInfo.district}
            onBack={() => setViewMode('list')}
            onMenuClick={() => setIsNavOpen(true)}
            onCartClick={() => setViewMode('basket')}
            onUseAsDeliveryPlace={(name) => {
              setCustomerInfo((prev) => ({ ...prev, district: name }));
              setViewMode('checkout');
            }}
          />
        );
      
      case 'confirmation':
        return (
          <ConfirmationPage
            cartItems={cartItems}
            cartCount={cartCount}
            onBack={handleBackFromConfirmation}
            onMenuClick={() => setIsNavOpen(true)}
            onUpdateQuantity={updateCartItemQuantity}
            onCompletePurchase={handleCompletePurchase}
          />
        );
      
      case 'orderConfirmation':
        return (
          <OrderConfirmationPage
            cartCount={0} // Cart is cleared after purchase
            customerInfo={customerInfo}
            onShop={handleShopFromOrderConfirmation}
            onMenuClick={() => setIsNavOpen(true)}
          />
        );
      
      case 'newsstand':
        return (
          <NewsstandPage
            onBack={handleBackToList}
            onMenuClick={() => setIsNavOpen(true)}
            onCartClick={handleCartClick}
            cartCount={cartCount}
          />
        );

      case 'about':
        return (
          <AboutPage
            onBack={handleBackToList}
            onMenuClick={() => setIsNavOpen(true)}
            onCartClick={handleCartClick}
            cartCount={cartCount}
          />
        );

      case 'profile':
        return (
          <ProfilePage
            customerInfo={customerInfo}
            customerSession={customerSession}
            onUpdateCustomerInfo={setCustomerInfo}
            onBack={handleBackToList}
            onMenuClick={() => setIsNavOpen(true)}
            onCartClick={handleCartClick}
            onLogout={handleLogout}
            cartCount={cartCount}
          />
        );

      case 'login':
        return (
          <LoginPage
            onBack={() => setViewMode('list')}
            onLogin={handleLoginSuccess}
            onNavigateToSignup={() => setViewMode('signup')}
          />
        );

      case 'signup':
        return (
          <SignupPage
            onBack={() => setViewMode('list')}
            onSignup={handleSignupSuccess}
            onNavigateToLogin={() => setViewMode('login')}
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      {/* iPhone 16 Container */}
      <div className="w-[393px] h-[852px] bg-[#ffffff] relative overflow-hidden rounded-[40px] shadow-2xl border-8 border-black">
        
        {renderCurrentView()}

        {/* Add to Cart Overlay */}
        <AddToCartOverlay
          isVisible={showOverlay}
          product={overlayProduct}
          quantity={overlayQuantity}
        />

        {/* Custom Menu */}
        <Menu
          isOpen={isNavOpen}
          onClose={() => setIsNavOpen(false)}
          onNavigate={handleMenuNavigation}
          isLoggedIn={!!customerSession}
        />
      </div>
    </div>
  );
}