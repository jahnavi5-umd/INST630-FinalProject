// Seed content taken directly from the TerpLink Figma Make file.
// Images are served locally from client/public/images (downloaded from the Figma file's sources).

export const organizations = [
  { name: "Robotics @ Maryland", category: "Technology", members: 624, color: "yellow",
    description: "Designing, building and competing with autonomous robots since 2003." },
  { name: "Maryland Music Collective", category: "Arts", members: 391, color: "red",
    description: "A home for student musicians of every genre - open jams, showcases and studio time." },
  { name: "Black Student Union", category: "Community", members: 1200, color: "black",
    description: "Uplifting Black students at UMD through culture, advocacy and community." },
  { name: "Student Entertainment Events", category: "Entertainment", members: 980, color: "red",
    description: "SEE brings concerts, comedy, films and Terps After Dark to campus." },
  { name: "Dingman Center for Entrepreneurship", category: "Career", members: 540, color: "yellow",
    description: "The University of Maryland's hub for student founders and startup careers." },
];

export const events = [
  {
    title: "Maryland Day",
    orgName: "University of Maryland",
    category: "Social",
    startsAt: "2027-04-18T10:00:00-04:00",
    endsAt: "2027-04-18T16:00:00-04:00",
    location: "McKeldin Mall",
    attendees: 5400,
    note: "Free admission",
    image: "/images/featured-maryland-day.jpg",
    featured: true,
    featuredLabel: "FEATURED ON CAMPUS",
    featuredHeadline: "One campus.\nA thousand ways to explore.",
    description:
      "Maryland Day is UMD's biggest open house: hundreds of free hands-on activities, performances and demos across campus.",
  },
  {
    title: "Spring Outdoor Movie Night",
    org: "Student Entertainment Events",
    category: "Social",
    startsAt: "2027-04-18T19:30:00-04:00",
    endsAt: "2027-04-18T22:00:00-04:00",
    location: "McKeldin Mall",
    attendees: 248,
    note: "Free popcorn",
    image: "/images/movie-night.jpg",
    description: "Bring a blanket and your friends for a screening under the stars on McKeldin Mall.",
  },
  {
    title: "Terps After Dark: Live",
    org: "Student Entertainment Events",
    category: "Arts & Music",
    startsAt: "2027-04-19T20:00:00-04:00",
    endsAt: "2027-04-19T23:30:00-04:00",
    location: "Stamp Grand Ballroom",
    attendees: 182,
    note: "Free food",
    image: "/images/terps-after-dark.jpg",
    description: "Live music, late-night eats and games - the best Saturday night on campus.",
  },
  {
    title: "Startup Career Mixer",
    org: "Dingman Center for Entrepreneurship",
    category: "Career",
    startsAt: "2027-04-22T17:00:00-04:00",
    endsAt: "2027-04-22T19:00:00-04:00",
    location: "Van Munching Hall",
    attendees: 94,
    note: "Business casual",
    image: "/images/career-mixer.jpg",
    description: "Meet founders and recruiters from the region's fastest-growing startups.",
  },
];

