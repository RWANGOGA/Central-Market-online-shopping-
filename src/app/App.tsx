import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router';
import { CartProvider, useCart } from './lib/cartProvider';
import { AuthProvider, useAuth, type CustomerInfo } from './lib/authProvider';
import { createOrder } from './lib/customerApi';

// Import all page components
import ProductListPage from './components/ProductListPage';
import ProductDetailPage from './components/ProductDetailPage';
import BasketPage from './components/BasketPage';
import CheckoutPage from './components/CheckoutPage';
import PaymentPage from './components/PaymentPage';
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

function ProductDetailRoute({ onMenuClick }: { onMenuClick: () => void }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { products, cartCount, stockLevels, stockLive, addToCart } = useCart();

  const productId = id ? Number(id) : NaN;
  const product = products.find((p) => p.id === productId);
  if (!product) return <Navigate to="/" replace />;

  return (
    <ProductDetailPage
      product={product}
      cartCount={cartCount}
      stockLevel={stockLevels.get(product.id) ?? null}
      stockLive={stockLive}
      onBack={() => navigate('/')}
      onAddToCart={(quantity) => addToCart(product.id, quantity)}
      onMenuClick={onMenuClick}
      onCartClick={() => navigate('/basket')}
    />
  );
}

function OrderConfirmationRoute({ onMenuClick }: { onMenuClick: () => void }) {
  const { reference } = useParams<{ reference: string }>();
  const navigate = useNavigate();
  const { cartCount } = useCart();
  const { customerInfo } = useAuth();

  return (
    <OrderConfirmationPage
      cartCount={cartCount}
      customerInfo={customerInfo}
      orderReference={reference}
      onShop={() => navigate('/')}
      onMenuClick={onMenuClick}
    />
  );
}

export default function App() {
  const navigate = useNavigate();
  const [isNavOpen, setIsNavOpen] = useState(false);
  const openMenu = () => setIsNavOpen(true);

  const {
    products,
    cartItems,
    cartId,
    cartCount,
    addToCart,
    updateCartItemQuantity,
    toggleFavorite,
    setSearchTerm,
    setSortOption,
    stockLevels,
    stockLive,
    showOverlay,
    overlayProduct,
    overlayQuantity,
    finalizePurchase,
  } = useCart();
  const {
    customerSession,
    customerInfo,
    login,
    logout,
    setCustomerInfo,
    purchaseError,
    setPurchaseError,
    orderReference,
    setOrderReference,
  } = useAuth();

  const handleMenuNavigation = (screen: string) => {
    const routeMap: Record<string, string> = {
      list: '/',
      map: '/map',
      newsstand: '/news',
      about: '/about',
      profile: '/profile',
      basket: '/basket',
      login: '/login',
    };
    if (screen === 'profile' && !customerSession) {
      navigate('/login');
      return;
    }
    navigate(routeMap[screen] || '/');
  };

  const handleProceedToPayment = async (customerData: CustomerInfo) => {
    setCustomerInfo(customerData);
    setPurchaseError(null);
    if (!cartId || cartItems.length === 0) {
      setPurchaseError('Your basket could not be checked out. Please refresh and try again.');
      return;
    }

    try {
      const order = await createOrder(cartId, {
        fullName: customerData.fullName.trim(),
        phone: customerData.phone.trim(),
        region: customerData.region,
        district: customerData.district || undefined,
        subCounty: customerData.subCounty || undefined,
        parish: customerData.parish || undefined,
        village: customerData.village || undefined,
        address: customerData.address.trim(),
      });
      if (!order.reference) throw new Error('The server did not return an order reference.');
      setOrderReference(order.reference);
      navigate(`/pay/${order.reference}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'We could not place your order. Please try again.';
      setPurchaseError(message);
      if (message.toLowerCase().includes('sold out')) {
        navigate('/basket');
      }
    }
  };

  const handleProceedToConfirmation = () => {
    finalizePurchase(cartId);
    navigate(`/order/${orderReference ?? ''}`);
  };

  return (
    <BrowserRouter>
      <CartProvider>
        <AuthProvider>
          <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            {/* iPhone 16 Container */}
            <div className="w-[393px] h-[852px] bg-[#ffffff] relative overflow-hidden rounded-[40px] shadow-2xl border-8 border-black">
              <Routes>
                <Route
                  path="/"
                  element={
                    <ProductListPage
                      products={products}
                      favorites={new Set()}
                      searchTerm={searchTerm}
                      sortOption={sortOption}
                      cartCount={cartCount}
                      onSearchChange={setSearchTerm}
                      onSortChange={setSortOption}
                      onToggleFavorite={toggleFavorite}
                      onAddToCart={(productId) => addToCart(productId, 1)}
                      onProductClick={(product) => navigate(`/product/${product.id}`)}
                      onMenuClick={openMenu}
                      onCartClick={() => navigate('/basket')}
                      stockLevels={stockLevels}
                      stockLive={stockLive}
                    />
                  }
                />
                <Route path="/product/:id" element={<ProductDetailRoute onMenuClick={openMenu} />} />
                <Route
                  path="/basket"
                  element={
                    <BasketPage
                      cartItems={cartItems}
                      onBack={() => navigate('/')}
                      onMenuClick={openMenu}
                      onUpdateQuantity={updateCartItemQuantity}
                      onGoToCheckout={() => navigate('/checkout')}
                      errorMessage={purchaseError}
                    />
                  }
                />
                <Route
                  path="/checkout"
                  element={
                    <CheckoutPage
                      cartCount={cartCount}
                      customerInfo={customerInfo}
                      onBack={() => navigate('/basket')}
                      onMenuClick={openMenu}
                      onProceedToPayment={handleProceedToPayment}
                    />
                  }
                />
                <Route
                  path="/pay/:reference"
                  element={
                    <PaymentPage
                      cartCount={cartCount}
                      cartId={cartId}
                      customerName={customerInfo.fullName}
                      onBack={() => navigate('/checkout')}
                      onMenuClick={openMenu}
                      onProceedToConfirmation={handleProceedToConfirmation}
                    />
                  }
                />
                <Route path="/order/:reference" element={<OrderConfirmationRoute onMenuClick={openMenu} />} />
                <Route
                  path="/profile"
                  element={
                    <ProfilePage
                      customerInfo={customerInfo}
                      customerSession={customerSession}
                      onUpdateCustomerInfo={setCustomerInfo}
                      onBack={() => navigate('/')}
                      onMenuClick={openMenu}
                      onCartClick={() => navigate('/basket')}
                      onLogout={logout}
                      onShopClick={() => navigate('/')}
                      cartCount={cartCount}
                    />
                  }
                />
                <Route
                  path="/login"
                  element={
                    <LoginPage
                      onBack={() => navigate('/')}
                      onLogin={login}
                      onNavigateToSignup={() => navigate('/signup')}
                    />
                  }
                />
                <Route
                  path="/signup"
                  element={
                    <SignupPage
                      onBack={() => navigate('/')}
                      onSignup={() => navigate('/login')}
                      onNavigateToLogin={() => navigate('/login')}
                    />
                  }
                />
                <Route
                  path="/map"
                  element={
                    <MapPage
                      cartCount={cartCount}
                      initialDistrict={customerInfo.district}
                      onBack={() => navigate('/')}
                      onMenuClick={openMenu}
                      onCartClick={() => navigate('/basket')}
                      onUseAsDeliveryPlace={(name) => {
                        setCustomerInfo({ ...customerInfo, district: name });
                        navigate('/checkout');
                      }}
                    />
                  }
                />
                <Route
                  path="/news"
                  element={
                    <NewsstandPage
                      onBack={() => navigate('/')}
                      onMenuClick={openMenu}
                      onCartClick={() => navigate('/basket')}
                      cartCount={cartCount}
                    />
                  }
                />
                <Route
                  path="/about"
                  element={
                    <AboutPage
                      onBack={() => navigate('/')}
                      onMenuClick={openMenu}
                      onCartClick={() => navigate('/basket')}
                      cartCount={cartCount}
                    />
                  }
                />
                <Route
                  path="/staff"
                  element={<AdminPage onClose={() => navigate('/')} />}
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>

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
        </AuthProvider>
      </CartProvider>
    </BrowserRouter>
  );
}
