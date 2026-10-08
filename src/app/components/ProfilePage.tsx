import React, { useState, useEffect, useCallback } from 'react';
import StatusBar from './shared/StatusBar';
import svgPaths from "../imports/svg-s5y93igtx2";
import { formatUgx } from "../lib/currency";
import { fetchCustomerProfile, updateCustomerProfile, fetchCustomerOrders, type CustomerProfile, type CustomerOrder } from '../lib/customerApi';

interface ProfilePageProps {
  customerInfo: {
    fullName: string;
    phone: string;
    region: string;
    district: string;
    subCounty: string;
    parish: string;
    village: string;
    address: string;
  };
  customerSession: {
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
  } | null;
  onUpdateCustomerInfo: (info: {
    fullName: string;
    phone: string;
    region: string;
    district: string;
    subCounty: string;
    parish: string;
    village: string;
    address: string;
  }) => void;
  onBack: () => void;
  onMenuClick: () => void;
  onCartClick: () => void;
  onLogout: () => void;
  cartCount: number;
}

type Tab = 'overview' | 'orders' | 'details' | 'preferences';

export default function ProfilePage({
  customerInfo,
  customerSession,
  onUpdateCustomerInfo,
  onBack,
  onMenuClick,
  onCartClick,
  onLogout,
  cartCount
}: ProfilePageProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedInfo, setEditedInfo] = useState(customerInfo);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCustomerProfile();
      setProfile(data);
      onUpdateCustomerInfo({
        fullName: data.fullName,
        phone: data.phone,
        region: data.region,
        district: data.district || '',
        subCounty: data.subCounty || '',
        parish: data.parish || '',
        village: data.village || '',
        address: data.address,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load profile');
    } finally {
      setLoading(false);
    }
  }, [onUpdateCustomerInfo]);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const data = await fetchCustomerOrders({ limit: 50 });
      setOrders(data.data);
    } catch {
      // Orders are optional; don't block the rest of the profile
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (activeTab === 'orders') {
      loadOrders();
    }
  }, [activeTab, loadOrders]);

  const displayName = profile?.fullName?.trim() || customerInfo.fullName.trim() || 'Guest shopper';
  const displayPhone = profile?.phone?.trim() || customerInfo.phone.trim() || 'No number saved';
  const displayAddress = profile?.address?.trim() || customerInfo.address.trim() || 'No delivery address saved';
  const displayPlace = [profile?.district || customerInfo.district, profile?.region || customerInfo.region].filter(Boolean).join(', ');
  const displayPlaceOrDefault = displayPlace || 'Kampala, Central Region';

  const memberSince = profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-UG', { month: 'long', year: 'numeric' }) : '2024';

  const totalSpent = orders.reduce((sum, order) => sum + order.total, 0);
  const activeOrders = orders.filter(o => ['pending', 'processing', 'shipped'].includes(o.status));

  const handleSave = async () => {
    try {
      const updated = await updateCustomerProfile({
        fullName: editedInfo.fullName,
        address: editedInfo.address,
        region: editedInfo.region,
        district: editedInfo.district,
        subCounty: editedInfo.subCounty,
        parish: editedInfo.parish,
        village: editedInfo.village,
      });
      setProfile(updated);
      onUpdateCustomerInfo(editedInfo);
      setIsEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save changes');
    }
  };

  const statusConfig: Record<string, { label: string; className: string }> = {
    pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800' },
    processing: { label: 'Processing', className: 'bg-blue-100 text-blue-800' },
    shipped: { label: 'Shipped', className: 'bg-purple-100 text-purple-800' },
    delivered: { label: 'Delivered', className: 'bg-green-100 text-green-800' },
    cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-800' },
  };

  return (
    <div className="bg-[#ffffff] relative size-full select-none">
      <StatusBar />

      {/* Header */}
      <div className="absolute bg-[#ffffff] h-[149px] left-0 right-0 top-0 z-10">
        <div className="absolute border-[0px_0px_1px] border-neutral-200 border-solid inset-0 pointer-events-none shadow-[0px_0px_20px_0px_rgba(0,0,0,0.1)]" />

        {/* Mobile Nav */}
        <div className="absolute bg-[#ffffff] h-16 left-0 overflow-clip right-0 top-[31px]">
          <div className="absolute bg-[#ffffff] h-[66px] left-0 top-0 w-[393px]" />
          <div
            className="absolute flex flex-col font-['Newsreader:Medium',_sans-serif] font-medium justify-center leading-[0] text-[#426b1f] text-[24px] text-center text-nowrap top-9 tracking-[-0.24px] translate-x-[-50%] translate-y-[-50%]"
            style={{ left: "calc(50% - 0.5px)" }}
          >
            <p className="adjustLetterSpacing block leading-none whitespace-pre text-[24px]">Mu Katale</p>
          </div>

          {/* Cart Icon */}
          <button
            onClick={onCartClick}
            aria-label="View basket"
            className="absolute right-5 rounded-2xl size-8 top-[18px] cursor-pointer"
          >
            <div className="size-8">
              <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 32 32">
                <g>
                  <path d={svgPaths.p2003cd00} fill="var(--fill-0, black)" />
                </g>
              </svg>
            </div>
            {cartCount > 0 && (
              <div className="absolute bg-[#426b1f] left-[17px] rounded-lg size-4 top-[-1px]">
                <div className="flex flex-col items-center justify-center relative size-full">
                  <div className="box-border content-stretch flex flex-col gap-2 items-center justify-center px-0.5 py-px relative size-4">
                    <div className="flex flex-col font-['Inter:Medium',_sans-serif] font-medium justify-center leading-[0] not-italic relative shrink-0 text-[#ffffff] text-[12px] text-center text-nowrap tracking-[-0.12px]">
                      <p className="adjustLetterSpacing block leading-none whitespace-pre text-[9px]">{cartCount}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </button>

          {/* Menu Hamburger */}
          <button
            onClick={onMenuClick}
            aria-label="Open navigation menu"
            className="absolute left-5 rounded-2xl size-8 top-[18px] flex items-center justify-center cursor-pointer"
          >
            <div className="h-1.5 w-[18px]">
              <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 18 8">
                <g>
                  <line stroke="var(--stroke-0, black)" strokeWidth="1.5" x2="18" y1="1.25" y2="1.25" />
                  <line stroke="var(--stroke-0, black)" strokeWidth="1.5" x2="18" y1="7.25" y2="7.25" />
                </g>
              </svg>
            </div>
          </button>
        </div>

        {/* Sub Nav */}
        <div className="absolute left-6 right-6 top-[103px]">
          <div className="box-border content-stretch flex flex-col font-normal items-center justify-start leading-[0] p-0 relative text-left w-full">
            <div className="basis-0 flex flex-col font-['Newsreader:Regular',_sans-serif] grow justify-center min-h-px min-w-px relative shrink-0 text-[#000000] text-[24px] tracking-[-0.48px]">
              <p className="block leading-[32px] text-[24px]">My Page</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={onBack}
                className="cursor-pointer flex items-center font-['Inter:Regular',_sans-serif] not-italic relative shrink-0 text-[#426b1f] text-[14px] text-nowrap tracking-[-0.14px] hover:opacity-80 transition-opacity"
              >
                <div className="flex flex-row items-center gap-1">
                  <div className="w-3 h-3">
                    <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 12 12">
                      <path d="M7.5 9L4.5 6L7.5 3" stroke="#426b1f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="adjustLetterSpacing block leading-[24px] whitespace-pre">Back</p>
                </div>
              </button>
              {customerSession && (
                <button
                  onClick={onLogout}
                  className="cursor-pointer flex items-center font-['Inter:Regular',_sans-serif] not-italic relative shrink-0 text-red-600 text-[14px] text-nowrap tracking-[-0.14px] hover:opacity-80 transition-opacity"
                >
                  <p className="adjustLetterSpacing block leading-[24px] whitespace-pre">Sign out</p>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="absolute left-0 right-0 top-[149px] bottom-0 overflow-y-auto">
        <div className="px-6 pt-5 pb-10 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-[13px] text-red-700 text-center">
              {error}
            </div>
          )}

          {saveSuccess && (
            <div className="p-3 bg-[#426b1f]/10 border border-[#426b1f]/30 rounded-lg text-[13px] text-[#426b1f] font-['Inter:Regular',_sans-serif] text-center">
              ✓ Profile updated successfully!
            </div>
          )}

          {/* User Bio Card */}
          <div className="border border-neutral-200 rounded-2xl p-4 bg-white flex items-center gap-4">
            <div className="size-14 rounded-full bg-[#426b1f] text-white flex items-center justify-center font-['Newsreader:Regular',_sans-serif] text-[22px] font-medium shrink-0">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="grow min-w-0">
              <h2 className="font-['Newsreader:Regular',_sans-serif] text-[20px] text-[#000000] leading-tight truncate">
                {displayName}
              </h2>
              <p className="font-['Inter:Regular',_sans-serif] text-[12px] text-[#757575] truncate">
                Member since {memberSince} • Farm Patron
              </p>
            </div>
          </div>

          {/* Overview Tab - Stats */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-neutral-200 rounded-xl p-4 bg-white">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[#757575] mb-1">Total Orders</p>
                  <p className="font-['Newsreader:Regular',_sans-serif] text-[28px] text-[#000000] leading-none">
                    {profile?.orderCount ?? orders.length}
                  </p>
                </div>
                <div className="border border-neutral-200 rounded-xl p-4 bg-white">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[#757575] mb-1">Total Spent</p>
                  <p className="font-['Newsreader:Regular',_sans-serif] text-[28px] text-[#000000] leading-none">
                    {formatUgx(totalSpent)}
                  </p>
                </div>
                <div className="border border-neutral-200 rounded-xl p-4 bg-white">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[#757575] mb-1">Active Orders</p>
                  <p className="font-['Newsreader:Regular',_sans-serif] text-[28px] text-[#000000] leading-none">
                    {activeOrders.length}
                  </p>
                </div>
                <div className="border border-neutral-200 rounded-xl p-4 bg-white">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[#757575] mb-1">Delivered</p>
                  <p className="font-['Newsreader:Regular',_sans-serif] text-[28px] text-[#000000] leading-none">
                    {orders.filter(o => o.status === 'delivered').length}
                  </p>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="border border-neutral-200 rounded-xl p-4 bg-white">
                <h3 className="font-['Inter:Medium',_sans-serif] text-[15px] text-[#000000] mb-3">Recent Orders</h3>
                <div className="space-y-3">
                  {orders.slice(0, 3).map((order) => {
                    const status = statusConfig[order.status] || { label: order.status, className: 'bg-neutral-100 text-neutral-800' };
                    return (
                      <div key={order.id} className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-0">
                        <div>
                          <p className="text-[13px] font-medium text-[#000000]">#{order.reference}</p>
                          <p className="text-[12px] text-[#757575]">
                            {new Date(order.createdAt).toLocaleDateString('en-UG', { month: 'short', day: 'numeric', year: 'numeric' })} • {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[13px] font-medium text-[#000000]">{formatUgx(order.total)}</p>
                          <span className={`text-[11px] px-2 py-0.5 rounded ${status.className}`}>{status.label}</span>
                        </div>
                      </div>
                    );
                  })}
                  {orders.length === 0 && (
                    <p className="text-[13px] text-[#757575] text-center py-4">No orders yet. Start shopping to see your history here.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Segmented Tab Controls */}
          <div className="flex rounded-lg bg-neutral-100 p-1 border border-neutral-200 text-[13px] font-['Inter:Regular',_sans-serif]">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex-1 py-1.5 rounded-md text-center transition-all ${
                activeTab === 'overview' ? 'bg-white text-[#426b1f] font-medium shadow-sm' : 'text-[#757575]'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`flex-1 py-1.5 rounded-md text-center transition-all ${
                activeTab === 'orders' ? 'bg-white text-[#426b1f] font-medium shadow-sm' : 'text-[#757575]'
              }`}
            >
              Orders
            </button>
            <button
              onClick={() => setActiveTab('details')}
              className={`flex-1 py-1.5 rounded-md text-center transition-all ${
                activeTab === 'details' ? 'bg-white text-[#426b1f] font-medium shadow-sm' : 'text-[#757575]'
              }`}
            >
              Details
            </button>
            <button
              onClick={() => setActiveTab('preferences')}
              className={`flex-1 py-1.5 rounded-md text-center transition-all ${
                activeTab === 'preferences' ? 'bg-white text-[#426b1f] font-medium shadow-sm' : 'text-[#757575]'
              }`}
            >
              Preferences
            </button>
          </div>

          {/* Tab: Orders */}
          {activeTab === 'orders' && (
            <div className="space-y-3 font-['Inter:Regular',_sans-serif]">
              {ordersLoading ? (
                <div className="p-8 text-center text-[#757575] text-[14px]">Loading orders...</div>
              ) : orders.length === 0 ? (
                <div className="p-8 text-center text-[#757575] text-[14px]">No orders yet.</div>
              ) : (
                orders.map((order) => {
                  const status = statusConfig[order.status] || { label: order.status, className: 'bg-neutral-100 text-neutral-800' };
                  return (
                    <div key={order.id} className="border border-neutral-200 rounded-xl p-4 bg-white space-y-2">
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="font-medium text-[#000000]">Order #{order.reference}</span>
                        <span className={`${status.className} px-2 py-0.5 rounded text-[11px] font-semibold`}>{status.label}</span>
                      </div>
                      <p className="text-[12px] text-[#757575]">
                        {new Date(order.createdAt).toLocaleDateString('en-UG', { month: 'short', day: 'numeric', year: 'numeric' })} • {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                      </p>
                      <div className="text-[13px] text-[#000000] pt-1 border-t border-neutral-100 space-y-1">
                        {order.items.map((item) => (
                          <div key={item.id} className="flex justify-between">
                            <span className="truncate mr-2">{item.name}</span>
                            <span className="font-medium whitespace-nowrap">{item.quantity} × {formatUgx(item.priceValue)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-neutral-100">
                        <span className="text-[12px] text-[#757575]">{order.region}{order.district ? `, ${order.district}` : ''}</span>
                        <span className="font-medium text-[#000000]">{formatUgx(order.total)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Tab: Shipping Details */}
          {activeTab === 'details' && (
            <div className="border border-neutral-200 rounded-xl p-4 bg-white space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                <span className="font-['Inter:Medium',_sans-serif] text-[15px] text-[#000000]">
                  Profile Details
                </span>
                <button
                  onClick={() => {
                    if (isEditing) handleSave();
                    else {
                      setEditedInfo({
                        fullName: profile?.fullName || customerInfo.fullName,
                        phone: profile?.phone || customerInfo.phone,
                        region: profile?.region || customerInfo.region,
                        district: profile?.district || customerInfo.district,
                        subCounty: profile?.subCounty || customerInfo.subCounty,
                        parish: profile?.parish || customerInfo.parish,
                        village: profile?.village || customerInfo.village,
                        address: profile?.address || customerInfo.address,
                      });
                      setIsEditing(true);
                    }
                  }}
                  className="text-[13px] font-['Inter:Regular',_sans-serif] text-[#426b1f] font-medium hover:underline"
                >
                  {isEditing ? 'Save Changes' : 'Edit'}
                </button>
              </div>

              {isEditing ? (
                <div className="space-y-3 font-['Inter:Regular',_sans-serif] text-[14px]">
                  <div>
                    <label className="text-[12px] text-[#757575] block mb-1">Full Name</label>
                    <input
                      type="text"
                      value={editedInfo.fullName}
                      onChange={(e) => setEditedInfo({ ...editedInfo, fullName: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-[14px]"
                    />
                  </div>
                  <div>
                    <label className="text-[12px] text-[#757575] block mb-1">Address</label>
                    <input
                      type="text"
                      value={editedInfo.address}
                      onChange={(e) => setEditedInfo({ ...editedInfo, address: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-[14px]"
                    />
                  </div>
                  <div>
                    <label className="text-[12px] text-[#757575] block mb-1">Phone number</label>
                    <input
                      type="tel"
                      value={editedInfo.phone}
                      onChange={(e) => setEditedInfo({ ...editedInfo, phone: e.target.value })}
                      placeholder="07XX XXX XXX"
                      className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-[14px]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[12px] text-[#757575] block mb-1">Region</label>
                      <input
                        type="text"
                        value={editedInfo.region}
                        onChange={(e) => setEditedInfo({ ...editedInfo, region: e.target.value })}
                        placeholder="Central Region"
                        className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-[14px]"
                      />
                    </div>
                    <div>
                      <label className="text-[12px] text-[#757575] block mb-1">District / town</label>
                      <input
                        type="text"
                        value={editedInfo.district}
                        onChange={(e) => setEditedInfo({ ...editedInfo, district: e.target.value })}
                        placeholder="Kampala"
                        className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-[14px]"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1 font-['Inter:Regular',_sans-serif] text-[14px] text-[#000000] leading-[22px]">
                  <p className="font-medium">{displayName}</p>
                  <p className="text-[#757575]">{displayPhone}</p>
                  <p className="text-[#757575]">{displayAddress}</p>
                  <p className="text-[#757575]">{displayPlaceOrDefault}</p>
                </div>
              )}
            </div>
          )}

          {/* Tab: Preferences */}
          {activeTab === 'preferences' && (
            <div className="border border-neutral-200 rounded-xl p-4 bg-white space-y-3 font-['Inter:Regular',_sans-serif] text-[14px]">
              <h4 className="font-['Inter:Medium',_sans-serif] text-[15px] text-[#000000]">
                Dietary & Delivery Notes
              </h4>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" defaultChecked className="accent-[#426b1f] w-4 h-4 rounded" />
                  <span className="text-[13px] text-[#000000]">Highlight Certified Vegan (VG) produce</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" defaultChecked className="accent-[#426b1f] w-4 h-4 rounded" />
                  <span className="text-[13px] text-[#000000]">Notify when Bukalasi Farm garlic harvests</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" defaultChecked className="accent-[#426b1f] w-4 h-4 rounded" />
                  <span className="text-[13px] text-[#000000]">Reuseable bags and crates preferred</span>
                </label>
              </div>
            </div>
          )}

          {/* Environmental Impact Widget */}
          <div className="border border-[#426b1f]/20 bg-[#426b1f]/5 rounded-xl p-4 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#426b1f]">Your Impact</span>
            <p className="font-['Newsreader:Regular',_sans-serif] text-[16px] text-[#000000]">
              {formatUgx(totalSpent)} of regional organic produce purchased
            </p>
            <p className="font-['Inter:Regular',_sans-serif] text-[12px] text-[#757575]">
              {orders.length} order{orders.length !== 1 ? 's' : ''} placed • {activeOrders.length} active
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
