// Categories for "What does it sell?". Every pool entry gets exactly one of these.
// answer: what the player sees. kw: phrases searched in title, description and Open Graph data.
// syn: extra words accepted in free-text mode. A site is kept only when one category clearly wins.

export const GROUPS = ['fashion', 'shop', 'software', 'money', 'travel', 'food', 'health', 'learning', 'media', 'home', 'mobility', 'services', 'tech'];

export const CATEGORIES = [
  // fashion and accessories
  { id: 'shoes', group: 'fashion', answer: 'Sells shoes', kw: ['shoes', 'sneakers', 'footwear', 'boots', 'sandals', 'running shoes', 'trainers'], syn: ['shoe', 'sneaker', 'boot'] },
  { id: 'clothing', group: 'fashion', answer: 'Sells clothing', kw: ['clothing', 'apparel', 'fashion', 'dresses', 't-shirts', 'jeans', 'menswear', 'womenswear', 'streetwear'], syn: ['clothes', 'shirt', 'fashion', 'wear'] },
  { id: 'jewelry', group: 'fashion', answer: 'Sells jewellery', kw: ['jewelry', 'jewellery', 'rings', 'necklaces', 'earrings', 'engagement rings', 'diamonds'], syn: ['ring', 'necklace', 'jewel'] },
  { id: 'watches', group: 'fashion', answer: 'Sells watches', kw: ['watches', 'watchmaker', 'timepieces', 'wristwatch', 'chronograph'], syn: ['watch', 'clock'] },
  { id: 'eyewear', group: 'fashion', answer: 'Sells glasses and sunglasses', kw: ['eyewear', 'eyeglasses', 'sunglasses', 'prescription glasses', 'contact lenses', 'frames'], syn: ['glasses', 'lenses', 'optician'] },
  { id: 'bags', group: 'fashion', answer: 'Sells bags and luggage', kw: ['handbags', 'backpacks', 'luggage', 'suitcases', 'leather goods', 'wallets'], syn: ['bag', 'backpack', 'suitcase'] },
  { id: 'cosmetics', group: 'fashion', answer: 'Sells skincare and make-up', kw: ['skincare', 'skin care', 'cosmetics', 'makeup', 'make-up', 'beauty products', 'serum', 'moisturizer', 'fragrance', 'perfume'], syn: ['beauty', 'makeup', 'cream', 'perfume'] },
  { id: 'outdoor', group: 'fashion', answer: 'Sells outdoor gear', kw: ['outdoor gear', 'hiking', 'camping gear', 'climbing', 'outdoor clothing', 'tents'], syn: ['camping', 'hiking', 'outdoor'] },
  { id: 'sportswear', group: 'fashion', answer: 'Sells sports gear', kw: ['sportswear', 'sporting goods', 'activewear', 'athletic', 'fitness apparel', 'cycling apparel'], syn: ['sport', 'gym', 'athletic'] },

  // general shops
  { id: 'marketplace', group: 'shop', answer: 'An online marketplace', kw: ['marketplace', 'buy and sell', 'online shopping', 'millions of products', 'shop online', 'deals'], syn: ['marketplace', 'store', 'shopping'] },
  { id: 'furniture', group: 'home', answer: 'Sells furniture', kw: ['furniture', 'sofas', 'couches', 'mattresses', 'beds', 'tables and chairs', 'home furnishings'], syn: ['sofa', 'chair', 'table', 'bed'] },
  { id: 'homedecor', group: 'home', answer: 'Sells home decor', kw: ['home decor', 'homeware', 'homewares', 'rugs', 'lighting', 'candles', 'interior design'], syn: ['decor', 'interior', 'lamp', 'rug'] },
  { id: 'kitchen', group: 'home', answer: 'Sells kitchenware', kw: ['cookware', 'kitchenware', 'knives', 'pans', 'kitchen appliances', 'coffee makers', 'blenders'], syn: ['kitchen', 'pan', 'knife', 'cooking'] },
  { id: 'garden', group: 'home', answer: 'Sells plants and garden supplies', kw: ['plants', 'garden', 'gardening', 'seeds', 'houseplants', 'nursery', 'flowers delivered'], syn: ['plant', 'flower', 'garden', 'seeds'] },
  { id: 'tools', group: 'home', answer: 'Sells tools and hardware', kw: ['power tools', 'hand tools', 'hardware store', 'diy', 'home improvement', 'drills'], syn: ['tool', 'hardware', 'diy'] },
  { id: 'pets', group: 'home', answer: 'Sells pet supplies', kw: ['pet supplies', 'dog food', 'cat food', 'pet food', 'pet store', 'dog toys'], syn: ['pet', 'dog', 'cat'] },
  { id: 'toys', group: 'shop', answer: 'Sells toys and games', kw: ['toys', 'board games', 'puzzles', 'lego', 'kids toys', 'games for kids'], syn: ['toy', 'game', 'puzzle'] },
  { id: 'books', group: 'shop', answer: 'Sells books', kw: ['books', 'bookstore', 'bookshop', 'ebooks', 'audiobooks', 'novels'], syn: ['book', 'reading', 'novel'] },
  { id: 'electronics', group: 'tech', answer: 'Sells electronics', kw: ['electronics', 'laptops', 'smartphones', 'headphones', 'tvs', 'cameras', 'gadgets'], syn: ['electronic', 'gadget', 'laptop', 'phone'] },
  { id: 'audio', group: 'tech', answer: 'Sells speakers and headphones', kw: ['speakers', 'headphones', 'earbuds', 'hi-fi', 'audio equipment', 'turntables', 'soundbar'], syn: ['speaker', 'headphone', 'audio', 'sound'] },
  { id: 'computer', group: 'tech', answer: 'Sells computers and parts', kw: ['pc components', 'graphics cards', 'gaming pc', 'computer hardware', 'motherboards', 'keyboards'], syn: ['computer', 'pc', 'hardware'] },
  { id: 'bikes', group: 'mobility', answer: 'Sells bicycles', kw: ['bikes', 'bicycles', 'e-bikes', 'ebikes', 'mountain bikes', 'road bikes', 'cycling'], syn: ['bike', 'bicycle', 'cycling'] },
  { id: 'music-gear', group: 'shop', answer: 'Sells musical instruments', kw: ['guitars', 'musical instruments', 'pianos', 'drums', 'synthesizers', 'amplifiers'], syn: ['instrument', 'guitar', 'music'] },
  { id: 'art-supplies', group: 'shop', answer: 'Sells art and craft supplies', kw: ['art supplies', 'craft supplies', 'yarn', 'fabric', 'sewing', 'paints'], syn: ['craft', 'art', 'yarn', 'sewing'] },
  { id: 'gifts', group: 'shop', answer: 'Sells gifts and personalised items', kw: ['gifts', 'personalized gifts', 'personalised gifts', 'gift ideas', 'custom prints', 'photo books'], syn: ['gift', 'present', 'personalised'] },
  { id: 'printing', group: 'services', answer: 'Prints cards, flyers and merch', kw: ['business cards', 'printing', 'flyers', 'custom t-shirts', 'stickers', 'print on demand'], syn: ['print', 'printing', 'flyer', 'sticker'] },

  // food and drink
  { id: 'coffee', group: 'food', answer: 'Sells coffee', kw: ['coffee', 'coffee beans', 'espresso', 'roastery', 'roasters'], syn: ['coffee', 'espresso', 'beans'] },
  { id: 'tea', group: 'food', answer: 'Sells tea', kw: ['tea', 'loose leaf tea', 'green tea', 'matcha', 'herbal tea'], syn: ['tea', 'matcha'] },
  { id: 'wine', group: 'food', answer: 'Sells wine and spirits', kw: ['wine', 'wines', 'winery', 'spirits', 'whisky', 'whiskey', 'gin', 'craft beer', 'brewery'], syn: ['wine', 'beer', 'spirits', 'alcohol'] },
  { id: 'grocery', group: 'food', answer: 'Delivers groceries', kw: ['groceries', 'grocery delivery', 'supermarket', 'fresh produce', 'online grocery'], syn: ['grocery', 'supermarket', 'food delivery'] },
  { id: 'mealkit', group: 'food', answer: 'Sends meal kits', kw: ['meal kits', 'meal kit', 'recipes delivered', 'meal delivery', 'ready meals'], syn: ['meal', 'kit', 'recipe'] },
  { id: 'restaurant', group: 'food', answer: 'A restaurant or food chain', kw: ['restaurant', 'menu', 'order online', 'pizza', 'burgers', 'takeaway', 'delivery and pickup'], syn: ['restaurant', 'pizza', 'burger', 'food'] },
  { id: 'snacks', group: 'food', answer: 'Sells snacks and sweets', kw: ['chocolate', 'snacks', 'candy', 'sweets', 'cookies', 'protein bars'], syn: ['chocolate', 'snack', 'candy', 'sweets'] },
  { id: 'supplements', group: 'health', answer: 'Sells vitamins and supplements', kw: ['supplements', 'vitamins', 'protein powder', 'nutrition', 'whey'], syn: ['vitamin', 'supplement', 'protein'] },

  // software
  { id: 'pm', group: 'software', answer: 'Project management software', kw: ['project management', 'task management', 'team collaboration', 'kanban', 'work management', 'projects & tasks', 'projects and tasks', 'manage projects', 'to-do list'], syn: ['project', 'tasks', 'team', 'planning'] },
  { id: 'crm', group: 'software', answer: 'CRM and sales software', kw: ['crm', 'sales pipeline', 'customer relationship', 'lead management', 'sales software'], syn: ['crm', 'sales', 'leads'] },
  { id: 'email-mkt', group: 'software', answer: 'Email marketing software', kw: ['email marketing', 'newsletters', 'marketing automation', 'email campaigns'], syn: ['email', 'newsletter', 'marketing'] },
  { id: 'design', group: 'software', answer: 'Design software', kw: ['design tool', 'graphic design', 'prototyping', 'ui design', 'photo editor', 'vector'], syn: ['design', 'graphic', 'editor'] },
  { id: 'website-builder', group: 'software', answer: 'Website builder', kw: ['website builder', 'build a website', 'create a website', 'ecommerce platform', 'online store builder'], syn: ['website', 'builder', 'site'] },
  { id: 'hosting', group: 'tech', answer: 'Web hosting and domains', kw: ['web hosting', 'domain names', 'vps', 'cloud hosting', 'wordpress hosting', 'dedicated servers'], syn: ['hosting', 'domain', 'server'] },
  { id: 'cloud', group: 'tech', answer: 'Cloud infrastructure', kw: ['cloud platform', 'infrastructure', 'kubernetes', 'serverless', 'cloud computing', 'databases'], syn: ['cloud', 'infrastructure', 'server'] },
  { id: 'security', group: 'tech', answer: 'Security and antivirus software', kw: ['antivirus', 'cybersecurity', 'endpoint security', 'password manager', 'vpn', 'malware protection'], syn: ['security', 'antivirus', 'vpn', 'password'] },
  { id: 'devtools', group: 'software', answer: 'Tools for developers', kw: ['developers', 'api', 'sdk', 'code review', 'ci/cd', 'observability', 'monitoring', 'developer platform'], syn: ['developer', 'code', 'api', 'programming'] },
  { id: 'analytics', group: 'software', answer: 'Analytics software', kw: ['analytics', 'dashboards', 'business intelligence', 'data platform', 'product analytics'], syn: ['analytics', 'data', 'dashboard'] },
  { id: 'hr', group: 'software', answer: 'HR and payroll software', kw: ['payroll', 'hr software', 'human resources', 'recruiting software', 'applicant tracking', 'employee'], syn: ['hr', 'payroll', 'hiring'] },
  { id: 'accounting', group: 'money', answer: 'Accounting and invoicing software', kw: ['accounting software', 'invoicing', 'bookkeeping', 'expense management', 'tax software'], syn: ['accounting', 'invoice', 'bookkeeping'] },
  { id: 'support', group: 'software', answer: 'Customer support software', kw: ['help desk', 'helpdesk', 'customer support', 'live chat', 'ticketing'], syn: ['support', 'helpdesk', 'chat'] },
  { id: 'scheduling', group: 'software', answer: 'Scheduling and booking software', kw: ['scheduling', 'appointment booking', 'online booking', 'calendar', 'booking software'], syn: ['schedule', 'booking', 'calendar'] },
  { id: 'notes', group: 'software', answer: 'Notes and documents app', kw: ['note-taking', 'notes app', 'documents', 'wiki', 'knowledge base', 'writing app'], syn: ['notes', 'docs', 'wiki'] },
  { id: 'video-call', group: 'software', answer: 'Video calls and team chat', kw: ['video conferencing', 'video calls', 'team chat', 'meetings', 'webinars'], syn: ['video', 'meeting', 'chat', 'call'] },
  { id: 'forms', group: 'software', answer: 'Online forms and surveys', kw: ['online forms', 'surveys', 'form builder', 'questionnaires', 'polls'], syn: ['form', 'survey', 'poll'] },
  { id: 'esign', group: 'software', answer: 'E-signature software', kw: ['e-signature', 'esignature', 'electronic signature', 'sign documents', 'contracts'], syn: ['signature', 'sign', 'contract'] },
  { id: 'storage', group: 'tech', answer: 'Cloud storage and file sharing', kw: ['cloud storage', 'file sharing', 'backup', 'file transfer', 'sync files'], syn: ['storage', 'backup', 'files'] },
  { id: 'ai', group: 'software', answer: 'AI tools', kw: ['ai assistant', 'artificial intelligence', 'machine learning', 'generative ai', 'ai writing', 'ai platform'], syn: ['ai', 'artificial intelligence'] },
  { id: 'games', group: 'media', answer: 'Video games', kw: ['video games', 'game studio', 'play now', 'multiplayer', 'pc games', 'console games'], syn: ['game', 'gaming', 'play'] },

  // money
  { id: 'bank', group: 'money', answer: 'A bank', kw: ['bank', 'banking', 'checking account', 'savings account', 'current account', 'mortgages'], syn: ['bank', 'account', 'banking'] },
  { id: 'payments', group: 'money', answer: 'Online payments', kw: ['payments', 'payment processing', 'checkout', 'accept payments', 'merchant'], syn: ['payment', 'pay', 'checkout'] },
  { id: 'insurance', group: 'money', answer: 'Sells insurance', kw: ['insurance', 'car insurance', 'home insurance', 'life insurance', 'health insurance'], syn: ['insurance', 'cover', 'policy'] },
  { id: 'invest', group: 'money', answer: 'Investing and trading', kw: ['investing', 'brokerage', 'stocks', 'trading platform', 'etfs', 'portfolio'], syn: ['invest', 'stock', 'trading'] },
  { id: 'loans', group: 'money', answer: 'Loans and credit', kw: ['loans', 'personal loans', 'credit cards', 'lending', 'credit score'], syn: ['loan', 'credit', 'lending'] },

  // travel and mobility
  { id: 'hotel', group: 'travel', answer: 'Hotel bookings', kw: ['hotels', 'hotel', 'resort', 'book your stay', 'accommodation', 'rooms'], syn: ['hotel', 'stay', 'room'] },
  { id: 'flights', group: 'travel', answer: 'Flights and airline tickets', kw: ['flights', 'airline', 'cheap flights', 'book flights', 'airfare'], syn: ['flight', 'airline', 'plane'] },
  { id: 'rentals', group: 'travel', answer: 'Holiday rentals', kw: ['vacation rentals', 'holiday rentals', 'holiday homes', 'cottages', 'villas'], syn: ['rental', 'holiday', 'cabin'] },
  { id: 'tours', group: 'travel', answer: 'Tours and travel packages', kw: ['tours', 'travel agency', 'holidays', 'vacation packages', 'cruises', 'excursions'], syn: ['tour', 'travel', 'cruise'] },
  { id: 'carrental', group: 'mobility', answer: 'Car rental', kw: ['car rental', 'rent a car', 'car hire', 'van rental'], syn: ['rental car', 'car hire', 'rent'] },
  { id: 'cars', group: 'mobility', answer: 'Sells cars', kw: ['cars', 'vehicles', 'used cars', 'new cars', 'dealership', 'electric vehicles', 'suv'], syn: ['car', 'vehicle', 'auto'] },
  { id: 'carparts', group: 'mobility', answer: 'Sells car parts', kw: ['car parts', 'auto parts', 'tyres', 'tires', 'accessories for your car'], syn: ['parts', 'tyre', 'tire'] },
  { id: 'transit', group: 'mobility', answer: 'Train and bus tickets', kw: ['train tickets', 'bus tickets', 'rail', 'coach travel', 'timetables'], syn: ['train', 'bus', 'ticket'] },
  { id: 'shipping', group: 'services', answer: 'Parcel delivery and shipping', kw: ['shipping', 'parcel', 'courier', 'track your package', 'logistics', 'freight'], syn: ['shipping', 'parcel', 'delivery', 'courier'] },

  // health
  { id: 'fitness', group: 'health', answer: 'Gym and fitness', kw: ['gym', 'fitness classes', 'workouts', 'personal training', 'fitness app', 'yoga'], syn: ['gym', 'fitness', 'workout', 'yoga'] },
  { id: 'telehealth', group: 'health', answer: 'Online doctor and health care', kw: ['telehealth', 'online doctor', 'healthcare', 'clinic', 'prescriptions', 'medical care'], syn: ['doctor', 'health', 'clinic', 'medical'] },
  { id: 'dental', group: 'health', answer: 'Dental care', kw: ['dentist', 'dental', 'teeth whitening', 'orthodontics', 'clear aligners'], syn: ['dentist', 'teeth', 'dental'] },
  { id: 'mental', group: 'health', answer: 'Therapy and mental health', kw: ['therapy', 'mental health', 'counselling', 'counseling', 'meditation', 'mindfulness'], syn: ['therapy', 'mental', 'meditation'] },
  { id: 'pharmacy', group: 'health', answer: 'An online pharmacy', kw: ['pharmacy', 'chemist', 'medicines', 'drugstore'], syn: ['pharmacy', 'medicine'] },

  // learning
  { id: 'courses', group: 'learning', answer: 'Online courses', kw: ['online courses', 'learn online', 'e-learning', 'certificates', 'bootcamp', 'tutorials'], syn: ['course', 'learn', 'class'] },
  { id: 'languages', group: 'learning', answer: 'Language learning', kw: ['learn a language', 'language learning', 'learn english', 'learn spanish', 'language courses'], syn: ['language', 'english', 'spanish'] },
  { id: 'university', group: 'learning', answer: 'A university or college', kw: ['university', 'college', 'undergraduate', 'postgraduate', 'admissions', 'campus'], syn: ['university', 'college', 'school'] },
  { id: 'tutoring', group: 'learning', answer: 'Tutoring and homework help', kw: ['tutoring', 'tutors', 'homework help', 'test prep', 'exam preparation'], syn: ['tutor', 'homework', 'exam'] },

  // media
  { id: 'news', group: 'media', answer: 'A news site', kw: ['news', 'breaking news', 'latest news', 'headlines', 'journalism'], syn: ['news', 'newspaper', 'headlines'] },
  { id: 'streaming', group: 'media', answer: 'Video streaming', kw: ['streaming', 'watch movies', 'tv shows', 'series', 'films online'], syn: ['stream', 'movie', 'tv', 'film'] },
  { id: 'music', group: 'media', answer: 'Music streaming', kw: ['music streaming', 'listen to music', 'playlists', 'podcasts', 'radio'], syn: ['music', 'song', 'podcast'] },
  { id: 'stock-media', group: 'media', answer: 'Stock photos and video', kw: ['stock photos', 'stock images', 'royalty-free', 'stock footage', 'vectors'], syn: ['stock', 'photos', 'images'] },
  { id: 'tickets', group: 'media', answer: 'Event tickets', kw: ['tickets', 'concerts', 'events', 'live music', 'festival tickets', 'theatre'], syn: ['ticket', 'concert', 'event'] },
  { id: 'recipes', group: 'media', answer: 'Recipes and cooking ideas', kw: ['recipes', 'easy recipes', 'cooking', 'dinner ideas', 'baking'], syn: ['recipe', 'cooking', 'baking'] },

  // services
  { id: 'jobs', group: 'services', answer: 'A job board', kw: ['jobs', 'job search', 'careers', 'hiring', 'find a job', 'job listings'], syn: ['job', 'career', 'work'] },
  { id: 'realestate', group: 'services', answer: 'Real estate listings', kw: ['real estate', 'homes for sale', 'property', 'apartments for rent', 'realtor', 'estate agents'], syn: ['house', 'property', 'real estate', 'apartment'] },
  { id: 'telecom', group: 'services', answer: 'Mobile and internet plans', kw: ['mobile plans', 'broadband', 'internet provider', 'sim only', 'fiber', 'phone plans'], syn: ['mobile', 'internet', 'broadband', 'sim'] },
  { id: 'energy', group: 'services', answer: 'Electricity and energy', kw: ['electricity', 'energy supplier', 'solar panels', 'gas and electricity', 'renewable energy', 'heat pumps'], syn: ['energy', 'electricity', 'solar'] },
  { id: 'legal', group: 'services', answer: 'Legal services', kw: ['law firm', 'lawyers', 'attorneys', 'legal services', 'solicitors'], syn: ['lawyer', 'legal', 'attorney'] },
  { id: 'cleaning', group: 'services', answer: 'Home cleaning and repairs', kw: ['cleaning services', 'house cleaning', 'plumbing', 'handyman', 'electricians', 'movers'], syn: ['cleaning', 'repair', 'plumber'] },
  { id: 'dating', group: 'services', answer: 'A dating app', kw: ['dating', 'singles', 'find love', 'dating app', 'matchmaking'], syn: ['dating', 'love', 'match'] },
  { id: 'agency', group: 'services', answer: 'A marketing or design agency', kw: ['agency', 'digital agency', 'branding', 'seo services', 'web design agency', 'creative studio'], syn: ['agency', 'marketing', 'branding'] },
  { id: 'photo', group: 'services', answer: 'Photo printing and photo books', kw: ['photo prints', 'photo printing', 'canvas prints', 'photo gifts'], syn: ['photo', 'print', 'canvas'] },
  { id: 'charity', group: 'services', answer: 'A charity', kw: ['charity', 'donate', 'nonprofit', 'non-profit', 'foundation', 'volunteer'], syn: ['charity', 'donate', 'nonprofit'] },
];

// Never keep these: adult, gambling, drugs, weapons, hate, scams. Checked in domain, title and description.
export const BLOCK_WORDS = [
  'porn', 'xxx', 'sex', 'adult', 'escort', 'nude', 'nsfw', 'camgirl', 'webcam girls', 'fetish', 'onlyfans', 'hentai',
  'casino', 'betting', 'sportsbook', 'poker', 'slots', 'lottery', 'gambling', 'bet365', 'jackpot', 'roulette',
  'cannabis', 'cbd', 'thc', 'weed', 'marijuana', 'vape', 'kratom', 'psychedelic', 'steroids', 'viagra',
  'firearm', 'firearms', 'guns', 'ammo', 'ammunition', 'rifle', 'pistol', 'tactical gear', 'knife fighting',
  'hate', 'nazi', 'white power', 'terror', 'crack', 'keygen', 'torrent', 'warez', 'hack tool', 'loan shark',
  'crypto casino', 'forex signals', 'get rich', 'replica watches',
];

// Parked domains, error pages, walls and logins: dropped.
export const JUNK_WORDS = [
  'domain is for sale', 'buy this domain', 'this domain may be for sale', 'parked free', 'domain parking', 'sedo', 'hugedomains',
  'page not found', '404 not found', 'access denied', 'forbidden', 'just a moment', 'attention required', 'are you a robot', 'captcha',
  'under construction', 'coming soon', 'account suspended', 'default web site page', 'welcome to nginx', 'it works!', 'index of /',
  'sign in to continue', 'log in to continue', 'your browser is not supported', 'enable javascript',
];

// Personal pages: dropped.
export const PERSONAL_WORDS = ['my portfolio', 'personal website', 'personal blog', 'my blog', 'about me', 'my resume', 'curriculum vitae', 'wedding', 'family blog'];

// Infrastructure domains that have no real homepage.
export const INFRA_WORDS = ['cdn', 'api', 'static', 'assets', 'analytics', 'tracking', 'adserver', 'ads', 'pixel', 'telemetry', 'akamai', 'cloudfront', 'edgekey', 'edgesuite', 'gstatic', 'googleapis', 'googleusercontent', 'doubleclick', 'amazonaws', 'azureedge', 'fbcdn', 'msedge', 'trafficmanager', 'appspot', 'herokuapp', 'cloudflare', 'fastly', 'mail', 'smtp', 'dns', 'ntp', 'push', 'update', 'login', 'auth', 'sso', 'metrics', 'stats', 'img', 'image', 'media', 'video', 'cache'];
