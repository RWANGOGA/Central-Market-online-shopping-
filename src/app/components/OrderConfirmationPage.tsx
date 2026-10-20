import React from 'react';
import svgPaths from "../imports/svg-x4vilrsbuo";
import DeliveryLocationMap from './DeliveryLocationMap';

interface OrderConfirmationPageProps {
  cartCount: number;
  customerInfo: CustomerInfo;
  onShop: () => void;
  onMenuClick: () => void;
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

export default function OrderConfirmationPage({ cartCount, customerInfo, onShop, onMenuClick }: OrderConfirmationPageProps) {
  // Generate estimated delivery date (3-5 business days from now)
  const getEstimatedDelivery = () => {
    const today = new Date();
    const deliveryDate = new Date(today);
    deliveryDate.setDate(today.getDate() + 4); // 4 days from now
    
    return deliveryDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Format address for display
  const formatAddress = () => {
    const addressParts = [
      customerInfo.fullName,
      customerInfo.address,
      // Most precise first, dropping any level that was never populated.
      [customerInfo.village, customerInfo.parish, customerInfo.subCounty, customerInfo.district]
        .filter(Boolean)
        .join(', '),
      customerInfo.region,
      customerInfo.phone
    ].filter(part => part && part.trim() !== '');

    return addressParts;
  };

  const formattedAddress = formatAddress();
  const estimatedDelivery = getEstimatedDelivery();

  return (
    <div className="bg-[#ffffff] relative size-full">
      {/* Status Bar */}
      <StatusBar />
      
      {/* Header */}
      <Header 
        cartCount={cartCount}
        onShop={onShop}
        onMenuClick={onMenuClick}
      />
      
      {/* Content */}
      <div className="absolute left-6 right-6 top-[149px] bottom-[124px] overflow-y-auto">
        <div className="py-6 space-y-6">
          
          {/* Status Message */}
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-full bg-[#426b1f] flex items-center justify-center shrink-0">
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <div>
              <h1 className="font-['Newsreader:Regular',_sans-serif] text-[24px] text-[#426b1f] tracking-[-0.48px] leading-[30px]">
                Your order is being prepared
              </h1>
            </div>
          </div>

          {/* Delivery location, on a real map centred on the chosen district */}
          <DeliveryLocationMap
            district={customerInfo.district}
            region={customerInfo.region}
            address={customerInfo.address}
          />

          {/* Two-Column Delivery Info Grid matching Figma MyBasket-2001-1785 */}
          <div className="grid grid-cols-2 gap-4 pt-1 border-t border-neutral-100">
            {/* Delivery To */}
            <div>
              <h3 className="font-['Inter:Regular',_sans-serif] text-[14px] text-[#757575] tracking-[-0.14px] leading-[24px] mb-1">
                Delivery to
              </h3>
              <div className="space-y-0.5">
                {formattedAddress.map((line, index) => (
                  <p key={index} className="font-['Inter:Regular',_sans-serif] text-[14px] text-[#000000] tracking-[-0.14px] leading-[22px]">
                    {line}
                  </p>
                ))}
              </div>
            </div>
            
            {/* Estimated Delivery */}
            <div>
              <h3 className="font-['Inter:Regular',_sans-serif] text-[14px] text-[#757575] tracking-[-0.14px] leading-[24px] mb-1">
                Estimated delivery
              </h3>
              <p className="font-['Inter:Regular',_sans-serif] text-[14px] text-[#000000] tracking-[-0.14px] leading-[22px]">
                {estimatedDelivery}
              </p>
              <p className="font-['Inter:Regular',_sans-serif] text-[12px] text-[#426b1f] mt-2 font-medium">
                Standard Eco Courier • Tracking enabled
              </p>
            </div>
          </div>

          {/* What happens next timeline */}
          <div className="bg-[#f8f9fa] rounded-xl p-4 space-y-3 border border-neutral-200">
            <h3 className="font-['Inter:Medium',_sans-serif] text-[15px] text-[#000000] tracking-[-0.16px]">
              What happens next?
            </h3>
            <div className="space-y-2.5">
              <div className="flex items-start gap-3">
                <div className="size-2.5 bg-[#426b1f] rounded-full mt-1.5 shrink-0" />
                <p className="font-['Inter:Regular',_sans-serif] text-[13px] text-[#000000] leading-[18px]">
                  Harvested & curated by our regional growers
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="size-2.5 bg-[#426b1f]/40 rounded-full mt-1.5 shrink-0" />
                <p className="font-['Inter:Regular',_sans-serif] text-[13px] text-[#757575] leading-[18px]">
                  Packed in 100% compostable insulated box
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="size-2.5 bg-neutral-300 rounded-full mt-1.5 shrink-0" />
                <p className="font-['Inter:Regular',_sans-serif] text-[13px] text-[#757575] leading-[18px]">
                  Delivered contact-free to your doorstep
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
      
      {/* Footer */}
      <Footer onShop={onShop} />
    </div>
  );
}

function StatusBar() {
  return (
    <div className="absolute h-[47px] left-0 overflow-clip right-0 top-0">
      <Notch />
      <LeftSide />
      <RightSide />
    </div>
  );
}

function Notch() {
  return (
    <div
      className="absolute h-[33px] top-[-2px] translate-x-[-50%] w-[156px]"
      style={{ left: "calc(50% + 0.499992px)" }}
    >
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 156 33">
        <g>
          <path d={svgPaths.p28770100} fill="black" />
          <path d={svgPaths.p28f48b80} fill="var(--fill-0, black)" />
          <path d={svgPaths.p14d82600} fill="var(--fill-0, black)" />
        </g>
      </svg>
    </div>
  );
}

function LeftSide() {
  return (
    <div className="absolute contents left-[25px] top-3.5">
      <div
        className="absolute h-[21px] rounded-3xl top-3.5 translate-x-[-50%] w-[54px]"
        style={{ left: "calc(50% - 135.5px)" }}
      >
        <div className="absolute css-a0byvc font-['SF_Pro_Display:Bold',_sans-serif] h-5 leading-[0] left-[27px] not-italic text-[#000000] text-[17px] text-center top-px tracking-[-0.408px] translate-x-[-50%] w-[54px]">
          <p className="adjustLetterSpacing block leading-[22px]">9:41</p>
        </div>
      </div>
    </div>
  );
}

function RightSide() {
  return (
    <div className="absolute contents left-[274px] top-[19px]">
      <div
        className="absolute h-[13px] top-[19px] translate-x-[-50%] w-[27.401px]"
        style={{ left: "calc(50% + 150.201px)" }}
      >
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 28 13">
          <g>
            <path d={svgPaths.p3f827980} opacity="0.35" stroke="var(--stroke-0, black)" />
            <path d={svgPaths.p5fdc300} fill="var(--fill-0, black)" opacity="0.4" />
            <path d={svgPaths.pbee4a00} fill="var(--fill-0, black)" />
          </g>
        </svg>
      </div>
      <div className="absolute bottom-[32.269%] left-[80%] right-[15.467%] top-[42.553%]">
        <div className="absolute bottom-[-0.002%] left-0 right-0 top-[0.002%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 17 12">
            <path d={svgPaths.p17a4bf30} fill="var(--fill-0, black)" />
          </svg>
        </div>
      </div>
      <div
        className="absolute h-3 top-5 translate-x-[-50%] w-[18px]"
        style={{ left: "calc(50% + 95.5px)" }}
      >
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 18 12">
          <g>
            <path d={svgPaths.p1ec31400} fill="var(--fill-0, black)" />
            <path d={svgPaths.p19f8d480} fill="var(--fill-0, black)" />
            <path d={svgPaths.p13f4aa00} fill="var(--fill-0, black)" />
            <path d={svgPaths.p1bfb7500} fill="var(--fill-0, black)" />
          </g>
        </svg>
      </div>
    </div>
  );
}

interface HeaderProps {
  cartCount: number;
  onShop: () => void;
  onMenuClick: () => void;
}

function Header({ cartCount, onShop, onMenuClick }: HeaderProps) {
  return (
    <div className="absolute bg-[#ffffff] h-[149px] left-0 right-0 top-0">
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
        <div className="absolute right-5 rounded-2xl size-8 top-[18px]">
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
                    <p className="adjustLetterSpacing block leading-none whitespace-pre">{cartCount}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Menu Icon */}
        <button 
          onClick={onMenuClick}
          className="absolute left-5 rounded-2xl size-8 top-[18px] flex items-center justify-center"
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
                  <p className="block leading-[32px] text-[24px]">Confirmed</p>
                </div>
                <button 
                  onClick={onShop}
                  className="cursor-pointer flex items-center font-['Inter:Regular',_sans-serif] not-italic relative shrink-0 text-[#426b1f] text-[14px] text-nowrap tracking-[-0.14px] hover:opacity-80 transition-opacity"
                >
                  <div className="flex flex-row items-center gap-1">
                    <div className="w-3 h-3">
                      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 12 12">
                        <path d="M7.5 9L4.5 6L7.5 3" stroke="#426b1f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <p className="adjustLetterSpacing block leading-[24px] whitespace-pre">Shop</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
    </div>
  );
}

interface FooterProps {
  onShop: () => void;
}

function Footer({ onShop }: FooterProps) {
  return (
    <div className="absolute bg-[#ffffff] bottom-0 h-[124px] left-0 overflow-clip right-0 shadow-[0px_0px_20px_0px_rgba(0,0,0,0.1)]">
      {/* Continue Shopping Button */}
      <button
        onClick={onShop}
        className="absolute left-6 right-6 rounded-lg top-6 bg-[#426b1f] cursor-pointer"
      >
        <div className="flex flex-row items-center relative size-full">
          <div className="box-border content-stretch flex flex-row gap-2 items-center justify-center pl-6 pr-6 py-2 relative w-full">
            <div className="flex flex-col font-['Inter:Regular',_sans-serif] font-normal justify-center leading-[0] not-italic relative text-[#ffffff] text-[16px] text-center tracking-[-0.16px]">
              <p className="block leading-[24px]">Continue shopping</p>
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}