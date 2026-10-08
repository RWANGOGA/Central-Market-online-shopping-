# Need Finding and Problem Identification
## Online Market Commodities Platform

**Makerere University**  
**College of Computing and Information Sciences**  
**CSC 3119: User Interface Design | Academic Year 2026/2027, Semester II**

**Due:** 6th October 2026, 5pm

---

## 1. Problem Statement

### Context

In Uganda, the procurement of fresh produce and market commodities involves a fragmented chain of physical market visits, telephone calls, and informal middlemen. Buyers — including hotels, schools, restaurants, and households — must contact multiple vendors to confirm availability and negotiate prices. Vendors and market administrators simultaneously struggle with order fragmentation, inconsistent stock records, and manual reconciliation of payments and deliveries. The absence of a shared digital surface means that price transparency, inventory accuracy, and order traceability are maintained through memory, paper, or ad-hoc messaging apps, creating inefficiencies and disputes on both sides.

### Problem Statement

**Buyers** cannot reliably discover current availability, unit prices, or delivery schedules for fresh market commodities without visiting the market or making dispersed phone calls. The absence of structured product information and transparent stock levels forces buyers to either over-order to avoid stockouts or under-order and miss requirements.

**Market administrators and vendors** lack integrated tools to publish stock, manage incoming orders, reconcile payments, and coordinate deliveries at scale. Existing workflows rely on manual note-taking and message threads, which do not enforce order status transitions, audit stock changes, or generate the documentation (invoices, receipts, delivery records) that institutional buyers require.

### How Might We Questions

- How might we give buyers real-time visibility into commodity availability and unit prices before they commit to an order?
- How might we allow administrators to manage stock and fulfil orders without increasing their operational workload or breaking existing workflows?
- How might we establish trust between buyers and vendors when goods cannot be inspected in person before purchase?
- How might we support both recurring bulk procurement (institutional buyers) and small ad-hoc purchases (households) within a single coherent interface without forcing one group into a unsuitable workflow?
- How might we make stock movements auditable so that every price change, delivery, and adjustment can be traced to a reason, a reference, and an actor?

---

## 2. Target Users

The system is designed for four primary user groups and one extreme-user category. Each group has distinct goals, constraints, and failure modes in the current manual workflow.

| User Group | Representative Role | Primary Goal | Key System Requirement |
| --- | --- | --- | --- |
| **Market Administrators / Vendors** | Market master, vendor coordinator | Publish stock, receive orders, update fulfilment status, record deliveries and adjustments | Admin dashboard with role-based authentication, product catalogue editor, order queue with controlled status transitions, stock ledger, supplier and purchase-order management |
| **Institutional Buyers** | Hotel procurement manager, school bursar | Place recurring or bulk orders with predictable delivery and documented invoices | Bulk cart entry, saved delivery addresses, order history with timeline, payment settlement with receipt, regional delivery configuration |
| **Household Buyers** | Household shopper | Browse available produce, compare prices, place small orders for delivery | Browseable catalogue with live stock levels, cart, checkout with location validation, order tracking |
| **Delivery Personnel** | Rider, driver | Retrieve assigned orders, confirm delivery, report stock returns | Order detail with fulfilment timeline, status transitions, stock-return workflow on cancellation |
| **Extreme User** | Elderly buyer with low digital literacy, visually impaired shopper, user on very low data, or vendor with limited English literacy | Complete an order despite sensory, connectivity, or literacy constraints | High-contrast readable text, large touch targets, minimal step count, image-first product recognition, low-bandwidth asset loading, localised language options |

### System-Aligned User Requirements

The target users above map directly to the capabilities of the built platform:

- **Real-time inventory**: `products.stock` is a cached total updated only through the stock ledger. The public catalogue and the admin inventory view read the same source of truth, so buyers see accurate availability and administrators see the same figures.
- **Price transparency**: Each product carries a `price_label` derived from `price_value` and `unit`, displayed consistently across the catalogue, cart, and order confirmation.
- **Order management**: Orders are created with a unique reference, drawn down through the ledger, and progressed through a defined state machine (`pending → processing → shipped → delivered`, with `cancelled` reachable before `delivered`). Every transition writes an `order_status_events` row.
- **Payment settlement**: Payment intents issue a one-time settlement token. The browser that opened the intent reports the outcome; a reference alone is insufficient, preventing replay or spoofing.
- **Stock traceability**: Every change to stock — sale, delivery, adjustment, waste, return, or correction — writes a `stock_movements` row with a reason, reference, and actor. Reconciliation is available as a diagnostic endpoint.
- **Geographic delivery validation**: The checkout form enforces Uganda's administrative hierarchy (region → district → sub-county → parish → village) before an order is accepted.
- **Live operational awareness**: An SSE stream pushes order creation and status changes to open admin dashboards, with a 30-second polling fallback.

---

## 3. Research Methodology

### Method

A mixed-methods approach combining **semi-structured interviews** (15–20 minutes per participant) with **structured market observation** (30–45 minutes per site). The combined method captures both stated preferences and actual behaviour, which frequently diverge in procurement contexts.

**Sample plan:** Minimum 12 participants, stratified across the four primary user groups. At least 2 administrators, 2 institutional buyers, 4 household buyers, and 2 delivery personnel. The extreme-user category is sampled opportunistically: recruit at least one participant who meets one or more of the identified extreme-user constraints. Participants are assigned codes (P1, P2, etc.); no names or other identifying information are recorded in the dataset.

**Observation sites:** Two to three market or delivery contexts per user group, selected to cover both high-volume institutional procurement and small-scale household purchasing.

### Ethics Script (read before each interview)

> "We are students from Makerere University conducting need-finding research for a class project in User Interface Design. We would like to ask you about your experience buying or selling market commodities. Your participation is voluntary, your answers are anonymous, and you may skip any question or stop at any time. With your permission, we will take written notes. Do you consent to participate?"

### Data Handling and Anonymity

No identifying information — names, phone numbers, exact addresses, or the names of specific organisations — is collected from participants. All interview and observation data is recorded under participant codes (for example, P1, P2, P3) and stored separately from any consent record. Personas presented in Section 5 are composite archetypes synthesised from coded data; they do not represent and are not traceable to any single individual.

### Observation Protocol

Observation is structured around five behavioural anchors, each designed to yield actionable UI/UX requirements rather than vague impressions:

1. **Information-seeking behaviour**: How does the participant discover what is available and at what price? Note the number of contacts made, the time taken, and the medium used (call, message, physical visit).
2. **Negotiation and confirmation**: How are quantities, prices, and delivery terms agreed? Note whether confirmation is written or verbal, and whether the participant records it themselves.
3. **Payment and documentation**: How is payment made, and what proof is exchanged? Note whether receipts or delivery notes are requested, and in what format.
4. **Error recovery**: Observe what happens when a delivery is late, a quantity is wrong, or a quality issue arises. Note the time to resolution and the communication channel used.
5. **Tool and environment constraints**: Note device type, screen size, lighting conditions, network reliability, and any accessibility aids used. These observations directly inform responsive design, contrast ratios, and offline-capability requirements.

Each observation is recorded as a structured field note with timestamp, user action, system action (or absence), and a one-sentence implication for the interface design.

---

## 4. Topic Guide and Questions

Questions are organised to progress from background to specific pain points, then to system requirements. Each section includes a behavioural focus so that the data collected describes what users *do*, not only what they *say* they want.

### A. Background and Procurement Role

1. Describe a typical week of buying or selling market commodities. What do you purchase or supply, in what quantities, and how often?
2. Who else is involved in the decision or transaction (kitchen staff, procurement officer, family member)? What information must you share with them before or after a purchase?

**Rationale:** Establishes the stakeholder map and the communication overhead that the system must support or replace.

### B. Current Process Walkthrough

3. Walk me through the most recent purchase or sale you made, step by step, from the moment you decided you needed something to the moment the goods were received and paid for.
4. When you need to know what is available or what price to expect, what do you do first? How many different sources do you check, and in what order?
5. How do you confirm that a vendor has the right quantity, quality, and price before you commit? What do you ask, and what do you record?
6. How do you pay, and what do you receive in return? Walk me through the last payment you made or received, including any messages, receipts, or physical notes exchanged.

**Rationale:** A step-by-step walkthrough exposes handoffs, delays, and the informal workarounds that a digital system must either replicate or eliminate.

### C. Pain Points and Failure Modes

7. Tell me about the last time something went wrong in this process — a wrong quantity, a quality dispute, a late delivery, or an unexpected price change. What happened, and how long did it take to resolve?
8. What information do you most often lack when placing or fulfilling an order? How do you compensate for not having it?
9. When you have to place an order urgently, what shortcuts do you take? What risks do those shortcuts create?

**Rationale:** These questions target specific failure events and coping strategies, which are stronger signals for interface design than general satisfaction ratings.

### D. Trust, Information Needs, and Documentation

10. If you could not see the goods before receiving them, what would you need to see or receive to feel confident that the order would be correct?
11. When you look at a product listing, which details matter most to you: photograph, weight or unit, origin, price per kilogram or per item, grade or quality label, or availability date? Rank the top three.
12. In what situations do you need an invoice, receipt, or delivery note? What must it contain for it to be useful to you or to the person you report to?

**Rationale:** These questions map directly to the product page schema, order timeline, and payment settlement design. Answers determine whether price per unit, product images, or delivery notes are primary or secondary interface elements.

### E. Technology, Connectivity, and Accessibility

13. What device do you use most for communication and ordering — make, model, and operating system? How would you describe your internet connection at home or at work?
14. Which applications do you use daily for communication, banking, or ordering? What do you find easy to use in those applications, and what do you find difficult?
15. If you were ordering commodities on a phone, what would make the process feel fast and reliable? What would make you abandon it halfway?
16. Would you prefer to use a mobile application, a website, or a messaging-based interface such as WhatsApp? Under what circumstances would you switch from one to another?

**Rationale:** These questions reveal platform preference, network constraints, and the minimum viable feature set. They directly inform the decision to optimise for mobile web, progressive enhancement, and low-data asset loading.

### F. Closing and Scenario Validation

17. Imagine a system that showed you exactly what was available, at what price, and allowed you to place an order for delivery in one session. What is the first thing you would check before trusting it?
18. Is there anything about the way you currently buy or sell that we have not asked about, but that you think is important?

### G. Administrator-Specific Questions

- How do you currently record what is in stock, and how do you update that record when a delivery arrives or a sale is made?
- When an order comes in, what steps do you take before the goods leave the market? Who confirms payment, and how?
- What reports or summaries do you need at the end of a day, week, or month? Who uses them, and what decisions do they support?
- If you had a tool that automatically reduced stock when an order was placed and recorded every change, what would you need to see to trust that the numbers were correct?

### H. Extreme-User Questions

- What is the hardest part of using a phone or website for you: seeing the screen, reading the text, understanding the language, finding the right button, or staying within your data budget?
- If you had an assistant or family member help you set up an order, what would you want that person to see on the screen so they could help quickly?
- Describe the simplest possible ordering experience you can imagine. What would be on the first screen, and what would you tap or say next?

---

## 5. User Personas

Personas are composite archetypes synthesised from coded interview and observation data. They are not portraits of real individuals and are not traceable to any single participant. They are intended to be revised as coded data is analysed; the versions presented here are working assumptions that define the design space.

---

### Persona 1: Institutional Procurement Manager

**Name:** James Okello  
**Age:** 42  
**Role:** Procurement Officer, a medium-sized boarding school  
**Location:** Mukono District  

**Psychographic Profile**  
James is responsible for feeding 420 students and 35 staff members three times a day. His success is measured by continuity of supply and adherence to budget, not by finding the lowest unit price. He is process-oriented: he wants a repeatable workflow with documented evidence for each transaction. He distrusts verbal agreements because he must answer to the school board and to auditors.

**Technical Proficiency**  
Moderate. Uses WhatsApp Business for supplier contact and a basic spreadsheet for monthly reconciliation. Comfortable with form-filling and file attachments. Unfamiliar with dashboards or real-time data feeds.

**Environmental Constraints**  
- Office internet is reliable during school terms; mobile data is used as backup.  
- Phone: Android 12, 6-inch screen, shared with two colleagues.  
- Workspace is a small office with fluorescent lighting and intermittent noise; readability and step reduction matter.  
- Must reconcile orders against a monthly budget cap, so order totals and invoice attachments are essential.

**Jobs to be Done**
1. **When I need to place a weekly produce order,** I want to select items by category, specify quantities per unit, and submit a single bulk order so that I do not place fragmented orders that complicate reconciliation.
2. **When an order is delivered,** I want to receive a digital receipt with itemised quantities, unit prices, and total, so that I can file it for audit without re-entering data into a spreadsheet.
3. **When a delivery is short or incorrect,** I want to report the discrepancy against the original order reference so that the vendor can correct it and the ledger reflects the return.

**System Implications**  
- Bulk cart entry with unit preservation (kg, crate, each).  
- Order detail page with timeline, payment record, and printable invoice.  
- Admin order-management interface with status transitions and stock-return on cancellation.

---

### Persona 2: Market Administrator

**Name:** Jane Nalubega  
**Age:** 38  
**Role:** Market Administrator, Nakasero Vendor Cooperative  
**Location:** Kampala Central Division  

**Psychographic Profile**  
Jane coordinates 28 vendors and wants to shift the cooperative from a walk-in market to a hybrid online-and-offline model. She is optimistic about technology but cautious about change management. Her daily stress comes from receiving the same price and availability question dozens of times by phone, then manually reconciling those answers against what vendors actually have. She values auditability because disputes with vendors over stock and payment are frequent.

**Technical Proficiency**  
High within her domain. Manages a WhatsApp group of 60 members, uses a spreadsheet for weekly summaries, and has used a basic inventory app before. Learns new interfaces quickly if they reduce repetitive data entry.

**Environmental Constraints**  
- Works from a market office with unreliable mains power; charges phone and laptop from a small solar bank.  
- Network: 3G mobile data with frequent drops during peak market hours.  
- Multilingual environment: vendors and buyers speak Luganda, Swahili, and English. The interface must not depend on English literacy alone.

**Jobs to be Done**
1. **When a vendor updates their stock or price,** I want to publish that change to the catalogue in one action so that buyers see accurate information without calling me.
2. **When an order is placed,** I want to see it in a queue with the buyer's region, delivery address, and payment status so that I can assign fulfilment without switching between apps.
3. **When stock is received from a supplier or returned from a cancelled order,** I want that change recorded with a reason and a reference so that the weekly stock report reconciles automatically.

**System Implications**  
- Admin product editor with image upload, price update, and stock threshold configuration.  
- Order queue with SSE live updates and filters by status and region.  
- Stock ledger with reason-coded movements and a reconciliation diagnostic.  
- Supplier and purchase-order management with delivery recording.

---

### Persona 3: Household Buyer

**Name:** Maria Achieng  
**Age:** 31  
**Role:** Parent, part-time freelance designer  
**Location:** Kira Municipality, Wakiso District  

**Psychographic Profile**  
Maria shops for a family of five. She cares about price fairness and produce freshness, but her primary constraint is time: she works from home with tight deadlines and has two young children. She is comfortable with mobile applications but uses them as tools, not as hobbies. She compares prices across two or three vendors before buying and values clear, honest labelling over promotional imagery.

**Technical Proficiency**  
High mobile literacy. Uses Instagram, WhatsApp, and a mobile banking app daily. Prefers swipe-based interfaces and search over menu navigation. Reads long text poorly on small screens.

**Environmental Constraints**  
- Primary device: Android smartphone, 5.5-inch screen.  
- Home Wi-Fi is reliable; mobile data is used when Wi-Fi drops, which happens twice a week.  
- Often shops between 7pm and 9pm after children are asleep; lighting is low and attention is fragmented.  
- Budget-conscious: needs to see total cost before committing, including delivery.

**Jobs to be Done**
1. **When I need dinner ingredients,** I want to see what is available, compare prices per kilogram, and add items to a cart in under two minutes so that I can return to work.
2. **When I place an order,** I want the delivery address and total — including delivery fee — confirmed before I pay, so that I am not surprised by an extra charge.
3. **When my order is on its way,** I want to see its status change without refreshing the page, so that I can plan cooking around the delivery.

**System Implications**  
- Mobile-first catalogue with image-first product cards, clear unit pricing, and persistent cart.  
- Checkout with location validation against the Ugandan administrative hierarchy and transparent fee calculation.  
- Order tracking page with live status updates via SSE or polling fallback.

---

### Persona 4: Delivery Rider

**Name:** Musa Kato  
**Age:** 26  
**Role:** Motorcycle delivery rider, contracted to two market vendors  
**Location:** Entebbe Road corridor  

**Psychographic Profile**  
Musa is paid per delivery and cares about route efficiency and clear drop-off instructions. He does not have time to call a vendor or buyer to clarify an address. His phone is a working tool, not a leisure device, and he uses it primarily for calls, WhatsApp, and mobile money. He isiliterate but not illiterate; he reads short text in Luganda and English.

**Technical Proficiency**  
Low. Comfortable with WhatsApp voice notes and calling. Uncomfortable with forms, maps, and scrolling lists. Prefers large buttons and voice or photo evidence over text entry.

**Environmental Constraints**  
- Device: low-end Android phone, 5-inch screen, often cracked.  
- Connectivity: 3G with frequent dropouts along the Entebbe corridor; offline capability is essential.  
- Works in bright sunlight and high traffic noise; screen readability and audio cues matter.  
- Data budget is limited to UGX 5,000 per week; the interface must minimise image and video weight.

**Jobs to be Done**
1. **When I collect an order,** I want to see the buyer's name, phone number, and landmark in large text on one screen, so that I can confirm the drop without scrolling or calling the office.
2. **When a delivery is successful,** I want to mark it complete with one tap so that the buyer and vendor are notified immediately.
3. **When a delivery fails or is refused,** I want to report the reason with one selection and a photo so that the order can be returned to stock without a phone call to the office.

**System Implications**  
- Order detail page prioritising delivery address, contact, and status action button.  
- One-tap status transitions for delivery staff.  
- Photo capture for proof-of-delivery or damage reporting.

---

### Persona 5: Extreme User — Low-Literacy Buyer

**Name:** Grace Nankinga  
**Age:** 68  
**Role:** Retired subsistence farmer, occasional market buyer  
**Location:** Rural sub-county, Mukono District  

**Psychographic Profile**  
Grace reads basic Luganda but cannot read English. She uses a feature phone or a basic smartphone shared with her granddaughter. She distrusts digital payments because she does not understand the screens, and she prefers to pay cash on delivery. She wants to order tomatoes and greens for her household but avoids markets because the walk is long and prices change between the walk to the market and the walk home.

**Technical Proficiency**  
Very low. Can receive and initiate WhatsApp voice calls. Can tap large buttons if they are labelled with images or Luganda text. Cannot type or navigate hierarchical menus.

**Environmental Constraints**  
- Device: shared smartphone, 5-inch screen, screen brightness often at minimum to save battery.  
- Connectivity: 2G network; images must be small and lazy-loaded.  
- Lighting: daytime only, often outdoors in shade.  
- Literacy: reads Luganda, not English. Numeracy is limited to whole numbers.

**Jobs to be Done**
1. **When I want to order tomatoes,** I want to see a clear photograph and the price in large text so that I can confirm I am selecting the right item without reading a description.
2. **When I confirm my order,** I want to see a single screen that says "Order sent" with a picture of what I ordered and the total price, so that I know it worked without calling my granddaughter to check.
3. **When the rider arrives,** I want to pay cash and receive a paper receipt or a message I can show to my family, so that I have proof of what I bought and at what price.

**System Implications**  
- Product cards with prominent images, large price text, and optional Luganda labels.  
- Checkout confirmation screen with order image, total, and a simple "Cash on delivery" indicator.  
- Order confirmation via SMS or WhatsApp message with image and total, readable without the app open.
- Admin and buyer interfaces must support Luganda localisation from the first release.

---

## 6. Structural Cohesion and Research Implications

The problem statement, user groups, research questions, and personas form a single argument:

**The manual market creates opaque pricing, fragile stock records, and untrusted remote ordering.** The solution is a digital marketplace in which stock is a live ledger, prices are explicit per unit, orders progress through a defined state machine, and every movement — sale, delivery, adjustment, or return — is recorded with a reason and an actor.

The research methodology is designed to validate or refute each element of that argument:

- The **process walkthrough** questions (Section 4B) will confirm whether buyers and administrators currently use ad-hoc messaging and phone calls as the primary coordination channel, which the system replaces with a structured order and status workflow.
- The **pain-point** questions (Section 4C) will surface specific failure modes — stockouts, wrong quantities, late deliveries — that the stock ledger, order timeline, and reconciliation endpoints are built to prevent or correct.
- The **trust and documentation** questions (Section 4D) will determine whether product images, unit labels, and digital receipts are primary or secondary interface elements, directly shaping the product page and payment settlement design.
- The **technology and accessibility** questions (Section 4E and 4H) will confirm the priority of low-data images, large touch targets, and Luganda localisation, which are first-class requirements in the built interface.

The personas operationalise these requirements as design constraints. Each persona includes a **Jobs to be Done** statement that maps to a specific feature or behaviour in the current system:

- James's bulk ordering maps to the cart and order-creation transaction.  
- Jane's stock-publishing and order-queue needs map to the admin product editor and SSE-driven order list.  
- Maria's cart, checkout, and tracking needs map to the public catalogue, location-validated checkout, and order-detail page.  
- Musa's delivery needs map to the admin order-detail view with one-tap transitions.  
- Grace's literacy and connectivity constraints map to image-first product cards, low-data asset strategy, and Luganda localisation.

If interview data contradicts any persona assumption, the persona is revised before the interface design phase. The system architecture — admin authentication, stock ledger, order state machine, payment settlement, geo validation, and SSE live updates — is fixed; the personas and interface design are the variables that must be validated against real user behaviour.

---

*Document version: 1.0 | Prepared for CSC 3119 Need Finding submission*
