/* Shared static content for the Dev Blog pages (projects, credentials, stack). */
export const tools = ['HTML/CSS', 'JavaScript', 'TypeScript', 'Java', 'Python', 'C++', 'SQL', 'Astro', 'React', 'Node.js', 'Git'];
export const marquee = ['Astro', 'TypeScript', 'JavaScript', 'Java', 'Python', 'C++', 'SQL', 'React', 'Node.js', 'SQLite WAL', 'UUIDv7', 'WebGL / Three.js', 'AWS', 'Networking'];

export const projects = [
  {
    id: 'bakingdesk',
    category: '/ full-stack',
    filterKey: 'full-stack',
    title: 'BakingDesk',
    subtitle: 'Integrated Project I',
    description:
      'My first integrated coursework project. I developed most of the backend with Java, Javalin & SQL and proposed the visual design direction. It challenged me both academically and personally.',
    date: 'Jul 28, 2026',
    href: '/blog/bakingdesk-integrated-project-case-study',
    cta: 'read case study',
    accent: '#a083fa',
    stack: ['Java', 'Javalin', 'SQL', 'Frontend Design'],
    blueprint: 'architecture',
  },
  {
    id: 'vitther',
    category: '/ web & mobile',
    filterKey: 'mobile',
    title: 'VITTHER',
    subtitle: 'Mobile Applications Project',
    description:
      "VITTHER is a mobile app for collectible figure enthusiasts. Currently in active development — I share architecture decisions, catalog modeling, and devlogs here on the blog.",
    date: 'Sep 15, 2026',
    href: 'http://127.0.0.1:4000/admin',
    cta: 'view draft in cms',
    accent: '#08f7fe',
    stack: ['Mobile UI', 'TypeScript', 'Offline Sync', 'Catalog DB'],
    blueprint: 'mobile',
  },
  {
    id: 'bayes-gt3',
    category: '/ python & data',
    filterKey: 'python',
    title: 'BAYES-GT3',
    subtitle: 'Applied Probability Engine',
    description:
      'Interactive statistical and Bayesian probability analysis application built with Python and Streamlit, deployed to production for real-time telemetry simulation.',
    date: 'Oct 18, 2026',
    href: 'https://bayes-gt3-diego-hernandez.streamlit.app',
    cta: 'launch live app',
    accent: '#ffb74d',
    stack: ['Python', 'Streamlit', 'Bayesian Stats', 'Data Viz'],
    blueprint: 'telemetry',
  },
];

export const credentials = [
  {
    title: 'Operating Systems Support',
    issuer: 'Cisco Networking Academy',
    chipClass: 'certification__chip--cisco',
    issued: 'Mar 2026',
    hours: 'Student Credential',
    url: 'https://www.credly.com/badges/03eb959e-4898-4d1b-8c2e-901ca72b7871',
  },
  {
    title: 'Operating Systems Basics',
    issuer: 'Cisco Networking Academy',
    chipClass: 'certification__chip--cisco',
    issued: 'Feb 2026',
    hours: 'Student Credential',
    url: 'https://www.credly.com/badges/46287a48-39b8-453e-8d1f-fcfed70c705e',
  },
  {
    title: 'AWS Academy Graduate — Cloud Foundations',
    issuer: 'AWS Academy',
    chipClass: 'certification__chip--aws',
    issued: 'Dec 2025',
    hours: '20 hours',
    url: 'https://www.credly.com/go/A3pxk32e',
  },
  {
    title: 'Introduction to Internet of Things',
    issuer: 'Cisco Networking Academy',
    chipClass: 'certification__chip--cisco',
    issued: 'Dec 2025',
    hours: 'Student Credential',
    url: 'https://www.credly.com/badges/45bd5fab-4f3f-4361-89cf-8196f8a2014d',
  },
  {
    title: 'Curso Profesional de C++',
    issuer: 'Azul School',
    chipClass: 'certification__chip--azulschool',
    issued: 'Nov 2025',
    hours: 'Verified ID',
    url: 'https://www.azulschool.net/verificacion-de-certificados/',
  },
  {
    title: 'Networking Basics',
    issuer: 'Cisco Networking Academy',
    chipClass: 'certification__chip--cisco',
    issued: 'Oct 2025',
    hours: 'Student Credential',
    url: 'https://www.credly.com/badges/7dbec3fe-7faf-432c-92ac-b48908fa5296',
  },
];
