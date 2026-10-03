import React from 'react';
import StatusBar from './shared/StatusBar';
import svgPaths from "../imports/svg-s5y93igtx2";

interface AboutPageProps {
  onBack: () => void;
  onMenuClick: () => void;
  onCartClick: () => void;
  cartCount: number;
}

const VALUES = [
  {
    title: "Direct from the Soil",
    description: "Every item in our catalogue is sourced directly from independent growers within 200 miles of your doorstep, bypassing long distribution hubs.",
    stat: "100%",
    statLabel: "Direct Sourced"
  },
  {
    title: "Fair Grower Compensation",
    description: "We guarantee transparent pricing where growers receive an average of 72 cents on every dollar spent, versus the conventional supermarket average of 14 cents.",
    stat: "72¢",
    statLabel: "Per Dollar to Farms"
  },
  {
    title: "Zero Waste Packaging",
    description: "All produce boxes are packed with 100% post-consumer unbleached fiber and compostable moisture barriers made from renewable plant starches.",
    stat: "0",
    statLabel: "Virgin Plastics"
  }
];

const FARMS = [
  { name: "Kunisaki Farms", location: "Gilroy, CA", specialty: "Organic garlic, brassicas & root herbs" },
  { name: "Helmbolt Orchards", location: "Salinas Valley, CA", specialty: "Snap peas, stone fruits & berries" },
  { name: "Bui Farms", location: "Hawaii & Central Coast", specialty: "Ginger root, turmeric & baby greens" },
  { name: "Castelao Farms", location: "Vidalia, GA", specialty: "Heirloom sweet alliums & winter squash" }
];

export default function AboutPage({ onBack, onMenuClick, onCartClick, cartCount }: AboutPageProps) {
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
                  <p className="block leading-[32px] text-[24px]">Who we are</p>
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
        <div className="px-6 pt-6 pb-10 space-y-6">
          {/* Mission Statement Hero */}
          <div className="border border-[#426b1f]/20 bg-[#426b1f]/5 rounded-2xl p-5 space-y-3">
            <span className="text-[11px] font-semibold text-[#426b1f] uppercase tracking-wider">Our Mission</span>
            <h2 className="font-['Newsreader:Regular',_sans-serif] text-[22px] text-[#000000] leading-[28px]">
              Rebuilding community food systems from the ground up.
            </h2>
            <p className="font-['Inter:Regular',_sans-serif] text-[14px] text-[#757575] leading-[22px]">
              "Mu Katale" began with a simple question: why do grocery tomatoes travel 1,500 miles when flavorful heritage varieties grow in neighboring valleys? We partner directly with organic family farms to harvest when ripe, not when hard.
            </p>
          </div>

          {/* Pillars of our Standard */}
          <div className="space-y-3">
            <h3 className="font-['Inter:Medium',_sans-serif] text-[16px] text-[#000000] tracking-[-0.16px]">
              The Mu Katale Standard
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {VALUES.map((item, idx) => (
                <div key={idx} className="p-4 border border-neutral-200 rounded-xl bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-['Newsreader:Regular',_sans-serif] text-[18px] text-[#000000]">
                      {item.title}
                    </h4>
                    <span className="text-[14px] font-bold text-[#426b1f] bg-[#426b1f]/10 px-2 py-0.5 rounded">
                      {item.stat}
                    </span>
                  </div>
                  <p className="font-['Inter:Regular',_sans-serif] text-[13px] text-[#757575] leading-[20px]">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Farm Partners Grid */}
          <div className="space-y-3">
            <h3 className="font-['Inter:Medium',_sans-serif] text-[16px] text-[#000000] tracking-[-0.16px]">
              Regional Farm Collective
            </h3>
            <div className="space-y-2">
              {FARMS.map((farm, idx) => (
                <div key={idx} className="p-3.5 border border-neutral-100 bg-[#fbfbfb] rounded-xl flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-['Inter:Medium',_sans-serif] text-[14px] text-[#000000]">{farm.name}</span>
                    <span className="text-[12px] text-[#426b1f] font-medium">{farm.location}</span>
                  </div>
                  <p className="text-[12px] font-['Inter:Regular',_sans-serif] text-[#757575]">
                    {farm.specialty}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer note */}
          <div className="pt-2 text-center text-[#757575] font-['Inter:Regular',_sans-serif] text-[12px]">
            <p>Certified B-Corporation • Member 1% for the Planet</p>
          </div>
        </div>
      </div>
    </div>
  );
}
