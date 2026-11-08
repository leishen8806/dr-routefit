import type { SiteCopy } from './types';

export const en: SiteCopy = {
  localeName: 'English',
  meta: {
    title: 'DR RouteFit | Smart dispatch and delivery',
    description: 'A clearer way for businesses, dispatchers and drivers to coordinate delivery.'
  },
  nav: { home: 'Home', drivers: 'Drivers & fleets', pricing: 'Pricing', about: 'About', help: 'Help', contact: 'Contact', menu: 'Open navigation', language: 'Language', skip: 'Skip to content' },
  pages: { drivers: 'Drivers & fleets', pricing: 'Pricing', about: 'About', help: 'Help', contact: 'Contact', terms: 'Terms of service', privacy: 'Privacy policy' },
  hero: {
    eyebrow: 'Clearer delivery coordination',
    title: 'The right vehicle. The right route. On time.',
    body: 'DR RouteFit helps businesses, dispatchers and drivers work through one traceable flow—from confirming a request to recording delivery evidence.',
    primary: 'See how it works', secondary: 'Contact us', note: 'The right vehicle. The right route. On time'
  },
  quick: [
    { title: 'Plan a delivery', body: 'See the flow from request confirmation to delivery records.', action: 'View the process', href: '#process' },
    { title: 'Track an order', body: 'Self-service order tracking will open in a later batch.', action: 'Coming soon', href: '#', badge: 'Coming soon' },
    { title: 'Drivers & fleets', body: 'Learn how drivers and fleet partners can work with RouteFit.', action: 'Explore partnerships', href: '/drivers/' }
  ],
  values: {
    eyebrow: 'Why RouteFit', title: 'Delivery is more than moving a parcel',
    items: [
      { icon: '01', title: 'Match vehicle to cargo', body: 'Make vehicle and cargo requirements clear before work begins.' },
      { icon: '02', title: 'Match route to service', body: 'Keep coverage, stops and route conditions on one operational thread.' },
      { icon: '03', title: 'Deliver on time', body: 'Coordinate around customer expectations and clear fulfilment steps.' },
      { icon: '04', title: 'Record every step', body: 'Keep key confirmations, status changes and delivery evidence traceable.' }
    ]
  },
  process: {
    eyebrow: 'How it works', title: 'A delivery in four clear steps',
    items: [
      { title: 'Share the request', body: 'Provide pickup, delivery, cargo and timing details.' },
      { title: 'Confirm and quote', body: 'Check service conditions before presenting a clear quote.' },
      { title: 'Arrange fulfilment', body: 'Dispatch coordinates the vehicle, driver and delivery steps.' },
      { title: 'Complete delivery', body: 'Record handovers and completion with traceable evidence.' }
    ]
  },
  coverage: { eyebrow: 'Service coverage', title: 'Confirm coverage before dispatch', body: 'Coverage opens in stages based on operating capacity. Acceptance depends on formal confirmation.', action: 'View service information' },
  audiences: [
    { eyebrow: 'Join RouteFit', title: 'Partner as a driver or fleet', body: 'Work from clear tasks, routes and handover records with less back-and-forth.', action: 'Driver partnerships', href: '/drivers/' },
    { eyebrow: 'Business partnerships', title: 'Make delivery operations easier to control', body: 'Connect requests, quotes and fulfilment evidence in one clear operational flow.', action: 'Contact partnerships', href: '/contact/' }
  ],
  faq: {
    eyebrow: 'Frequently asked questions', title: 'What to know before you start',
    items: [
      { question: 'What does RouteFit provide?', answer: 'RouteFit focuses on delivery request confirmation, quote coordination, dispatch and fulfilment records. Final scope depends on formal confirmation.' },
      { question: 'Can customers place orders online now?', answer: 'Customer self-service is planned for a later batch. For now, use the formal contact channel to submit a request.' },
      { question: 'How do I know whether my address is covered?', answer: 'After a request is submitted, operations checks it against the currently published service area.' },
      { question: 'How is pricing determined?', answer: 'Pricing depends on the active pricing policy and order conditions. The website does not publish unapproved prices.' }
    ]
  },
  footer: {
    summary: 'Clearer vehicles, routes and delivery records.', product: 'Services', company: 'Company', support: 'Support', legal: 'Legal', terms: 'Terms of service', privacy: 'Privacy policy', rights: 'All rights reserved.'
  },
  placeholder: { eyebrow: 'Page in progress', title: 'Coming soon', body: 'This page belongs to a later website batch and is not yet available.', back: 'Back to home' }
};
