import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { registerAuthHandler } from './apiAuth';

export interface CustomerSession {
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

export interface CustomerInfo {
  fullName: string;
  phone: string;
  region: string;
  district: string;
  subCounty: string;
  parish: string;
  village: string;
  address: string;
}

const EMPTY_INFO: CustomerInfo = {
  fullName: '',
  phone: '',
  region: '',
  district: '',
  subCounty: '',
  parish: '',
  village: '',
  address: '',
};

interface AuthContextType {
  customerSession: CustomerSession | null;
  customerInfo: CustomerInfo;
  setCustomerInfo: (info: CustomerInfo) => void;
  purchaseError: string | null;
  setPurchaseError: (message: string | null) => void;
  orderReference: string | null;
  setOrderReference: (reference: string | null) => void;
  login: (customer: CustomerSession) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [customerSession, setCustomerSession] = useState<CustomerSession | null>(null);
  const [customerInfo, setCustomerInfoState] = useState<CustomerInfo>(EMPTY_INFO);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [orderReference, setOrderReference] = useState<string | null>(null);
  const navigate = useNavigate();

  // Treat any API 401 as logged out: clear the session and return to the shop.
  useEffect(() => {
    registerAuthHandler(() => {
      setCustomerSession(null);
      setCustomerInfoState(EMPTY_INFO);
      setPurchaseError(null);
      setOrderReference(null);
      navigate('/');
    });
  }, []);

  const login = useCallback((customer: CustomerSession) => {
    setCustomerSession(customer);
    setCustomerInfoState({
      fullName: customer.fullName,
      phone: customer.phone,
      region: customer.region,
      district: customer.district || '',
      subCounty: customer.subCounty || '',
      parish: customer.parish || '',
      village: customer.village || '',
      address: customer.address,
    });
    navigate('/profile');
  }, []);

  const logout = useCallback(() => {
    setCustomerSession(null);
    setCustomerInfoState(EMPTY_INFO);
    setPurchaseError(null);
    setOrderReference(null);
    navigate('/');
  }, []);

  const value: AuthContextType = {
    customerSession,
    customerInfo,
    setCustomerInfo: setCustomerInfoState,
    purchaseError,
    setPurchaseError,
    orderReference,
    setOrderReference,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
