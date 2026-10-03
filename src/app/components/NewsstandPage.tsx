import React from 'react';
import StatusBar from './shared/StatusBar';
import svgPaths from "../imports/svg-s5y93igtx2";

interface NewsstandPageProps {
  onBack: () => void;
  onMenuClick: () => void;
  onCartClick: () => void;
  cartCount: number;
}

interface Article {
  id: string;
  category: string;
  title: string;
  readTime: string;
  date: string;
  author: string;
  summary: string;
  tag: string;
  heroColor: string;
}

const ARTICLES: Article[] = [
  {
    id: '1',
    category: 'Seasonal harvest',
    title: 'Why Heirloom Tomatoes Taste Like Summer Itself',
    readTime: '4 min read',
    date: 'Oct 1, 2026',
    author: 'Elena Vance, Agronomist',
    summary: 'Unlike supermarket varieties bred primarily for shelf life and uniform shipping crates, heirloom cultivars preserve complex sugars and rich aromatics passed down generations.',
    tag: 'Field Notes',
    heroColor: 'bg-[#426b1f]/10',
  },
  {
    id: '2',
    category: 'Farm partner spotlight',
    title: 'Morning Dew at Kunisaki Farms: 3 Generations of Soil Stewards',
    readTime: '6 min read',
    date: 'Sep 27, 2026',
    author: 'Marcus Reed',
    summary: 'In Gilroy, CA, the Kunisaki family rotated cover crops and avoided synthetic fungicides long before organic certification became the industry gold standard.',
    tag: 'Grower Story',
    heroColor: 'bg-[#8ca862]/15',
  },
  {
    id: '3',
    category: 'Kitchen craft',
    title: 'Sweet Onions & Young Ginger: Quick Pickling for Crisp Autumn Salads',
    readTime: '3 min read',
    date: 'Sep 21, 2026',
    author: 'Chef Maya Lin',
    summary: 'A 10-minute rice wine brine transforms fresh crisp radishes and tender ginger into vibrant table condiments that brighten any weeknight dinner.',
    tag: 'Recipe',
    heroColor: 'bg-[#5c7f38]/10',
  },
  {
    id: '4',
    category: 'Zero waste pantry',
    title: 'Never Toss Kale Stems: Charred Relish & Garden Pestos',
    readTime: '5 min read',
    date: 'Sep 14, 2026',
    author: 'World Peas Editorial',
    summary: 'Simple techniques from our kitchen lab to make sure every leaf, stem, and root from your weekly delivery basket finds a delicious purpose.',
    tag: 'Sustainability',
    heroColor: 'bg-[#426b1f]/10',
  }
];

export default function NewsstandPage({ onBack, onMenuClick, onCartClick, cartCount }: NewsstandPageProps) {
  const [selectedCategory, setSelectedCategory] = React.useState<string>('All');
  const [bookmarkedIds, setBookmarkedIds] = React.useState<Set<string>>(new Set());

  const categories = ['All', 'Field Notes', 'Grower Story', 'Recipe'];

  const filteredArticles = selectedCategory === 'All' 
    ? ARTICLES 
    : ARTICLES.filter(a => a.tag === selectedCategory);

  const toggleBookmark = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setBookmarkedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="bg-[#ffffff] relative size-full select-none">
      {/* Status Bar */}
      <StatusBar />

      {/* Header */}
      <div className="absolute bg-[#ffffff] h-[149px] left-0 right-0 top-0 z-10">
        <div className="absolute border-[0px_0px_1px] border-neutral-200 border-solid inset-0 pointer-events-none shadow-[0px_0px_20px_0px_rgba(0,0,0,0.1)]" />

        {/* Mobile Nav Top Bar */}
        <div className="absolute bg-[#ffffff] h-16 left-0 overflow-clip right-0 top-[31px]">
          <div className="absolute bg-[#ffffff] h-[66px] left-0 top-0 w-[393px]" />
          <div
            className="absolute flex flex-col font-['Newsreader:Medium',_sans-serif] font-medium justify-center leading-[0] text-[#426b1f] text-[24px] text-center text-nowrap top-9 tracking-[-0.24px] translate-x-[-50%] translate-y-[-50%]"
            style={{ left: "calc(50% - 0.5px)" }}
          >
            <p className="adjustLetterSpacing block leading-none whitespace-pre text-[24px]">World Peas</p>
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
                  <p className="block leading-[32px] text-[24px]">Newsstand</p>
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

      {/* Main Scrollable Content */}
      <div className="absolute left-0 right-0 top-[149px] bottom-0 overflow-y-auto">
        <div className="px-6 pt-5 pb-8 space-y-5">
          {/* Tag Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-[13px] font-['Inter:Regular',_sans-serif] whitespace-nowrap transition-colors ${
                  selectedCategory === cat 
                    ? 'bg-[#426b1f] text-white font-medium' 
                    : 'bg-[#f5f5f5] text-[#757575] hover:bg-neutral-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Lead Article Card */}
          {filteredArticles.length > 0 && (
            <div className="border border-neutral-200 rounded-xl overflow-hidden bg-white shadow-sm hover:border-[#426b1f]/40 transition-all">
              <div className="p-4 bg-gradient-to-br from-[#426b1f]/10 via-[#426b1f]/5 to-white border-b border-neutral-100 flex items-start justify-between">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-[#426b1f] bg-white/80 px-2.5 py-1 rounded-md border border-[#426b1f]/20">
                  {filteredArticles[0].category}
                </span>
                <button
                  onClick={(e) => toggleBookmark(filteredArticles[0].id, e)}
                  className="text-[#426b1f] hover:scale-110 transition-transform"
                  aria-label="Bookmark article"
                >
                  <svg className="w-5 h-5" fill={bookmarkedIds.has(filteredArticles[0].id) ? "#426b1f" : "none"} viewBox="0 0 24 24" stroke="#426b1f" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                  </svg>
                </button>
              </div>
              <div className="p-4 space-y-2.5">
                <h3 className="font-['Newsreader:Regular',_sans-serif] text-[20px] text-[#000000] leading-[26px]">
                  {filteredArticles[0].title}
                </h3>
                <p className="font-['Inter:Regular',_sans-serif] text-[13px] text-[#757575] leading-[20px]">
                  {filteredArticles[0].summary}
                </p>
                <div className="pt-2 flex items-center justify-between text-[12px] text-[#757575] font-['Inter:Regular',_sans-serif] border-t border-neutral-100">
                  <span>{filteredArticles[0].author}</span>
                  <span className="text-[#426b1f] font-medium">{filteredArticles[0].readTime}</span>
                </div>
              </div>
            </div>
          )}

          {/* Secondary Articles */}
          <div className="space-y-3">
            {filteredArticles.slice(1).map(article => (
              <div
                key={article.id}
                className="p-4 border border-neutral-200 rounded-xl bg-white hover:border-[#426b1f]/30 transition-all flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#426b1f] uppercase tracking-wide">
                    {article.category}
                  </span>
                  <button
                    onClick={(e) => toggleBookmark(article.id, e)}
                    className="text-[#426b1f]"
                    aria-label="Bookmark article"
                  >
                    <svg className="w-4 h-4" fill={bookmarkedIds.has(article.id) ? "#426b1f" : "none"} viewBox="0 0 24 24" stroke="#426b1f" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                    </svg>
                  </button>
                </div>
                <h4 className="font-['Newsreader:Regular',_sans-serif] text-[17px] text-[#000000] leading-[22px]">
                  {article.title}
                </h4>
                <p className="font-['Inter:Regular',_sans-serif] text-[12px] text-[#757575] leading-[18px] line-clamp-2">
                  {article.summary}
                </p>
                <div className="pt-2 flex items-center justify-between text-[11px] text-[#757575] font-['Inter:Regular',_sans-serif]">
                  <span>{article.date}</span>
                  <span className="text-[#426b1f] font-medium">{article.readTime}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Community Bulletin Note */}
          <div className="bg-[#f8f9fa] border border-neutral-200 rounded-xl p-4 text-center space-y-1">
            <p className="font-['Newsreader:Regular',_sans-serif] text-[16px] text-[#426b1f]">
              World Peas Gazette • Issue No. 42
            </p>
            <p className="font-['Inter:Regular',_sans-serif] text-[12px] text-[#757575]">
              Published bi-weekly for community members supporting organic and regenerative soil farming.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
