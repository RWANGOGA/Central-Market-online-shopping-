import React, { useState } from 'react';
import StatusBar from './shared/StatusBar';
import svgPaths from "../imports/svg-s5y93igtx2";
import { formatUgx } from "../lib/currency";

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

interface ProfilePageProps {
  customerInfo: CustomerInfo;
  onUpdateCustomerInfo: (info: CustomerInfo) => void;
  onBack: () => void;
  onMenuClick: () => void;
  onCartClick: () => void;
  cartCount: number;
}

export default function ProfilePage({
  customerInfo,
  onUpdateCustomerInfo,
  onBack,
  onMenuClick,
  onCartClick,
  cartCount
}: ProfilePageProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'orders' | 'preferences'>('details');
  const [isEditing, setIsEditing] = useState(false);
  const [editedInfo, setEditedInfo] = useState<CustomerInfo>(customerInfo);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Fallback details if customer hasn't purchased yet
  const displayName = customerInfo.fullName.trim() || 'Guest shopper';
  const displayPhone = customerInfo.phone.trim() || 'No number saved';
  const displayAddress = customerInfo.address.trim() || 'No delivery address saved';
  const displayPlace = [customerInfo.district, customerInfo.region].filter(Boolean).join(', ');
  const displayPlaceOrDefault = displayPlace || 'Kampala, Central Region';

  const handleSave = () => {
    onUpdateCustomerInfo(editedInfo);
    setIsEditing(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  return (
    <div className="bg-[#ffffff] relative size-full select-none">
      {/* Status Bar */}
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
          <div className="box-border content-stretch flex flex-col gap-4 items-end justify-end p-0 relative w-full">
            <div className="relative shrink-0 w-full">
              <div className="box-border content-stretch flex flex-row font-normal items-center justify-start leading-[0] p-0 relative text-left w-full">
                <div className="basis-0 flex flex-col font-['Newsreader:Regular',_sans-serif] grow justify-center min-h-px min-w-px relative shrink-0 text-[#000000] text-[24px] tracking-[-0.48px]">
                  <p className="block leading-[32px] text-[24px]">My Profile</p>
                </div>
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
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="absolute left-0 right-0 top-[149px] bottom-0 overflow-y-auto">
        <div className="px-6 pt-5 pb-10 space-y-5">
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
                Member since 2024 • Verified Farm Patron
              </p>
            </div>
          </div>

          {/* Segmented Tab Controls */}
          <div className="flex rounded-lg bg-neutral-100 p-1 border border-neutral-200 text-[13px] font-['Inter:Regular',_sans-serif]">
            <button
              onClick={() => setActiveTab('details')}
              className={`flex-1 py-1.5 rounded-md text-center transition-all ${
                activeTab === 'details' ? 'bg-white text-[#426b1f] font-medium shadow-sm' : 'text-[#757575]'
              }`}
            >
              Shipping Details
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`flex-1 py-1.5 rounded-md text-center transition-all ${
                activeTab === 'orders' ? 'bg-white text-[#426b1f] font-medium shadow-sm' : 'text-[#757575]'
              }`}
            >
              Order History
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

          {saveSuccess && (
            <div className="p-3 bg-[#426b1f]/10 border border-[#426b1f]/30 rounded-lg text-[13px] text-[#426b1f] font-['Inter:Regular',_sans-serif] text-center">
              ✓ Shipping details saved successfully!
            </div>
          )}

          {/* Tab 1: Shipping Details */}
          {activeTab === 'details' && (
            <div className="border border-neutral-200 rounded-xl p-4 bg-white space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                <span className="font-['Inter:Medium',_sans-serif] text-[15px] text-[#000000]">
                  Default Delivery Address
                </span>
                <button
                  onClick={() => {
                    if (isEditing) handleSave();
                    else {
                      setEditedInfo({
                        fullName: displayName,
                        phone: customerInfo.phone,
                        region: customerInfo.region,
                        district: customerInfo.district,
                        subCounty: customerInfo.subCounty,
                        parish: customerInfo.parish,
                        village: customerInfo.village,
                        address: customerInfo.address
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

          {/* Tab 2: Order History */}
          {activeTab === 'orders' && (
            <div className="space-y-3 font-['Inter:Regular',_sans-serif]">
              <div className="p-4 border border-neutral-200 rounded-xl bg-white space-y-2">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="font-medium text-[#000000]">Order #MK-84920</span>
                  <span className="text-[#426b1f] bg-[#426b1f]/10 px-2 py-0.5 rounded text-[11px] font-semibold">Active</span>
                </div>
                <p className="text-[12px] text-[#757575]">Placed Oct 2, 2026 • 3 items</p>
                <div className="text-[13px] text-[#000000] pt-1 border-t border-neutral-100 flex justify-between">
                  <span>Fresh Harvest Box (Ginger, Garlic, Peas)</span>
                  <span className="font-medium">{formatUgx(45936)}</span>
                </div>
              </div>

              <div className="p-4 border border-neutral-200 rounded-xl bg-white space-y-2 opacity-80">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="font-medium text-[#000000]">Order #MK-81204</span>
                  <span className="text-[#757575] bg-neutral-100 px-2 py-0.5 rounded text-[11px]">Delivered</span>
                </div>
                <p className="text-[12px] text-[#757575]">Delivered Sep 24, 2026 • 4 items</p>
                <div className="text-[13px] text-[#000000] pt-1 border-t border-neutral-100 flex justify-between">
                  <span>Sweet Onions &amp; Avocados</span>
                  <span className="font-medium">{formatUgx(37303)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Dietary & Preferences */}
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
              14.2 lbs of regional organic produce purchased
            </p>
            <p className="font-['Inter:Regular',_sans-serif] text-[12px] text-[#757575]">
              Saved an estimated 38 vehicle food-miles through local collective delivery.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
