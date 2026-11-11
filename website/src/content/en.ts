import type { SiteCopy } from './types';

export const en: SiteCopy = {
  localeName: 'English',
  meta: {
    title: 'DR RouteFit | Smart dispatch and delivery',
    description: 'The right vehicle, the right route and on-time delivery across Phnom Penh and nearby areas.'
  },
  nav: { home: 'Home', services: 'Services', drivers: 'Drivers & fleets', pricing: 'Pricing', track: 'Track order', about: 'About', help: 'Help centre', contact: 'Contact us', menu: 'Open navigation', language: 'Language', skip: 'Skip to content' },
  pages: { drivers: 'Drivers & fleets', pricing: 'Pricing', about: 'About', help: 'Help', contact: 'Contact', terms: 'Terms of service', privacy: 'Privacy policy' },
  hero: {
    eyebrow: "Cambodia's last mile, delivered to the right hands",
    title: 'Match the vehicle. Match the route. Deliver on time.',
    body: 'RouteFit helps merchants move goods from warehouse to customer: choose a vehicle for the cargo, dispatch by route, and keep records for handover, transit and receipt.',
    primary: 'Discuss a business partnership', secondary: 'I am a driver and want to join', note: "Cambodia's last mile, delivered to the right hands",
    route: ['Pickup', 'Vehicle', 'Delivery', 'Handover proof']
  },
  quick: [
    { title: 'I need a delivery', body: 'Delivery for merchants and warehouse customers, with approved business monthly billing.', action: 'Discuss a partnership', href: '/contact/' },
    { title: 'I am a driver', body: 'Individual drivers and partner fleets can apply and earn from completed deliveries.', action: 'How to join', href: '/drivers/' },
    { title: 'Track an order', body: 'Enter an order number to see delivery progress.', action: 'Coming soon', href: '#', badge: 'Coming soon' }
  ],
  values: {
    eyebrow: 'How we work', title: 'Get three things right: vehicle, route and time',
    items: [
      { icon: '01', title: 'Match vehicle to cargo', body: 'Select by cargo weight, volume and type. Vehicles that do not fit are not dispatched.' },
      { icon: '02', title: 'Match route to service', body: 'Plan by service area and delivery time; dispatch confirms before assigning the job.' },
      { icon: '03', title: 'Deliver on time', body: 'Check the promised arrival before dispatch and tell you early if it cannot be met.' },
      { icon: '04', title: 'Record every step', body: 'Warehouse handover, driver checks and receipt all leave evidence so issues can be traced.' }
    ]
  },
  process: {
    eyebrow: 'Order process', title: 'Four steps from order to receipt',
    items: [
      { title: 'Submit the order', body: 'Provide pickup and delivery addresses, package count and expected delivery time.' },
      { title: 'Confirm the quote and pay', body: 'Charges are itemised. Pay after confirmation; approved business customers settle monthly.' },
      { title: 'Assign vehicle and driver', body: 'Dispatch assigns by cargo and route; the driver checks each item at the warehouse before departure.' },
      { title: 'Receipt and proof', body: 'The recipient signs and photo evidence is kept, so you can check each item’s outcome.' }
    ]
  },
  coverage: { eyebrow: 'Service area', title: 'Phnom Penh and nearby', body: 'Deliveries currently leave from a Phnom Penh warehouse and serve the city and nearby areas. Final availability depends on address validation when ordering; new areas will be updated here.', action: 'Ask whether my address is covered', mapLabel: 'Service area: Phnom Penh and nearby' },
  audiences: [
    { eyebrow: 'Join RouteFit', title: 'Join RouteFit as a driver or fleet', body: 'Earn by completed delivery and settle on a regular cycle. Individual drivers and partner fleets can apply and start after approval.', action: 'How to join', href: '/drivers/' },
    { eyebrow: 'About us', title: 'Business and investment partnerships', body: 'We are building a warehousing and delivery dispatch platform in Cambodia. Warehouses, merchants, fleets and investors are welcome to contact us.', action: 'Share your interest', href: '/contact/' }
  ],
  faq: {
    eyebrow: 'Help centre', title: 'Frequently asked questions',
    items: [
      { question: 'How do I place an order?', answer: 'Orders currently go through a customer manager. A Telegram self-service entry will be added here when available.' },
      { question: 'When do I pay?', answer: 'Pay after confirming the quote and before a vehicle is assigned. Approved business customers settle monthly.' },
      { question: 'Can I change the address after ordering?', answer: 'You can request an address or time change. The system will re-quote, and the change takes effect after you confirm it.' },
      { question: 'What if cargo is lost or damaged?', answer: 'Delivery includes basic cargo-damage protection, and commercial insurance can be purchased separately. The service terms govern.' }
    ]
  },
  footer: {
    summary: "Cambodia's last mile, delivered to the right hands", product: 'Services', company: 'Company', support: 'Support', legal: 'Legal', terms: 'Terms of service', privacy: 'Privacy policy', rights: 'All rights reserved.'
  },
  placeholder: {
    eyebrow: 'Page in progress', title: 'Coming soon', body: 'This page belongs to a later website batch and is not yet available.', back: 'Back to home',
    pricingFacts: ['Each quote lists its charges separately.', 'Charges apply only after the quote is confirmed.', 'Every quote has an expiry time.']
  }
};
