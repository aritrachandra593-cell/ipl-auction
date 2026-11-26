// Real 2027 IPL mini-auction data available as of 17 Nov 2026.
// Purses/slots are from iplt20.com/auction/2027; retention/release lists are from the published franchise lists.
(function (root) {
  'use strict';

  const OVERSEAS = new Set([
    'Dewald Brevis', 'Noor Ahmad', 'Akeal Hosein', 'Jamie Overton',
    'Corbin Bosch', 'Mitchell Santner', 'Quinton de Kock', 'Ryan Rickelton',
    'Sherfane Rutherford', 'Will Jacks',
    'Tim David', 'Nuwan Thushara', 'Jacob Duffy', 'Phil Salt', 'Jordan Cox',
    'Josh Hazlewood', 'Romario Shepherd',
    'Cameron Green', 'Finn Allen', 'Rovman Powell', 'Tim Seifert', 'Sunil Narine',
    'Pat Cummins', 'Heinrich Klaasen', 'Brydon Carse', 'Eshan Malinga',
    'Jofra Archer', 'Nandre Burger', 'Dasun Shanaka', 'Donovan Ferreira', 'Lhuan-dre Pretorius',
    'David Miller', 'Kyle Jamieson', 'Lungi Ngidi', 'Tristan Stubbs',
    'Marco Jansen', 'Marcus Stoinis', 'Azmatullah Omarzai', 'Ben Dwarshuis',
    'Cooper Connolly', 'Xavier Bartlett',
    'Jos Buttler', 'Rashid Khan', 'Kagiso Rabada', 'Jason Holder', 'Glenn Phillips', 'Tom Banton',
    'Nicholas Pooran', 'Aiden Markram', 'Josh Inglis', 'Mitchell Marsh', 'Sam Curran',
    'Matt Henry', 'Matt Short', 'Zak Foulkes', 'Spencer Johnson', 'Dian Forrester',
    'AM Ghazanfar', 'Keshav Maharaj', 'Trent Boult',
    'Jacob Bethell', 'Richard Gleeson',
    'Matheesha Pathirana', 'Mustafizur Rahman', 'Rachin Ravindra', 'Blessing Muzarbani',
    'Travis Head', 'Gerald Coetzee', 'David Payne', 'Kamindu Mendis', 'Dilshan Madushanka',
    'Adam Milne', 'Kwena Maphaka', 'Shimron Hetmyer',
    'Mitchell Starc', 'Pathum Nissanka', 'Ben Duckett', 'Dushmantha Chameera', 'Rehan Ahmed',
    'Mitchell Owen', 'Lockie Ferguson',
    'Luke Wood', 'Connor Esterhuizen',
    'Anrich Nortje', 'Wanindu Hasaranga', 'Matthew Breetzke', 'George Linde',

    'Ben Stokes', 'David Warner', 'Fazalhaq Farooqi', 'Mujeeb Ur Rahman',
    'Rahmanullah Gurbaz', 'Jake Fraser-McGurk', 'Jhye Richardson', 'Mahli Beardman',
    'Jonny Bairstow', 'Sam Billings', 'Sonny Baker', 'Tom Curran',
    'Ben Sears', 'Bevon Jacobs', 'Daryl Mitchell', 'Devon Conway',
    'Will O\'Rourke', 'Shai Hope'
  ]);

  const ROLE = {
    'Ruturaj Gaikwad': 'BAT', 'Sanju Samson': 'WK', 'Kartik Sharma': 'WK', 'Urvil Patel': 'WK',
    'Sarfaraz Khan': 'BAT', 'Ayush Mhatre': 'BAT', 'Dewald Brevis': 'BAT', 'Noor Ahmad': 'SPIN',
    'Akeal Hosein': 'SPIN', 'Mukesh Choudhary': 'FAST', 'Jamie Overton': 'FAST', 'Shivam Dube': 'ALL',
    'Ramakrishna Ghosh': 'ALL', 'Gurjapneet Singh': 'FAST', 'Anshul Kamboj': 'FAST',
    'Shreyas Gopal': 'SPIN', 'Rahul Chahar': 'SPIN',

    'Arshdeep Singh': 'FAST', 'Ashwani Kumar': 'FAST', 'Corbin Bosch': 'ALL', 'Jasprit Bumrah': 'FAST',
    'Mitchell Santner': 'SPIN', 'Naman Dhir': 'ALL', 'Quinton de Kock': 'WK', 'Raghu Sharma': 'SPIN',
    'Raj Angad Bawa': 'ALL', 'Rohit Sharma': 'BAT', 'Ryan Rickelton': 'WK', 'Shardul Thakur': 'ALL',
    'Sherfane Rutherford': 'BAT', 'Suryakumar Yadav': 'BAT', 'Tilak Varma': 'BAT', 'Will Jacks': 'ALL',

    'Abhinandan Singh': 'FAST', 'Kanishk Chouhan': 'SPIN', 'Suyash Sharma': 'SPIN',
    'Bhuvneshwar Kumar': 'FAST', 'Krunal Pandya': 'ALL', 'Tim David': 'BAT', 'Devdutt Padikkal': 'BAT',
    'Nuwan Thushara': 'FAST', 'Venkatesh Iyer': 'ALL', 'Jacob Duffy': 'FAST', 'Phil Salt': 'WK',
    'Vicky Ostwal': 'SPIN', 'Jitesh Sharma': 'WK', 'Rajat Patidar': 'BAT', 'Virat Kohli': 'BAT',
    'Jordan Cox': 'WK', 'Rasikh Dar': 'FAST', 'Yash Dayal': 'FAST', 'Josh Hazlewood': 'FAST',
    'Romario Shepherd': 'ALL',

    'Angkrish Raghuvanshi': 'BAT', 'Anukul Roy': 'ALL', 'Cameron Green': 'ALL', 'Finn Allen': 'BAT',
    'Harshit Rana': 'FAST', 'Kartik Tyagi': 'FAST', 'Manish Pandey': 'BAT', 'Prashant Solanki': 'SPIN',
    'Ramandeep Singh': 'ALL', 'Rinku Singh': 'BAT', 'Rovman Powell': 'BAT', 'Sarthak Ranjan': 'BAT',
    'Saurabh Dubey': 'FAST', 'Sunil Narine': 'SPIN', 'Tim Seifert': 'WK', 'Vaibhav Arora': 'FAST',
    'Varun Chakaravarthy': 'SPIN',

    'Pat Cummins': 'FAST', 'Abhishek Sharma': 'BAT', 'Ishan Kishan': 'WK', 'Heinrich Klaasen': 'WK',
    'Nitish Kumar Reddy': 'ALL', 'Brydon Carse': 'FAST', 'Salil Arora': 'BAT', 'Aniket Verma': 'BAT',
    'Harsh Dubey': 'SPIN', 'Smaran Ravichandran': 'BAT', 'Praful Hinge': 'FAST', 'Sakib Hussain': 'FAST',
    'Shivang Kumar': 'ALL', 'Krans Fuletra': 'SPIN', 'Eshan Malinga': 'FAST',

    'Riyan Parag': 'BAT', 'Yashasvi Jaiswal': 'BAT', 'Vaibhav Sooryavanshi': 'BAT',
    'Ravindra Jadeja': 'ALL', 'Dhruv Jurel': 'WK', 'Jofra Archer': 'FAST', 'Aman Rao Perala': 'BAT',
    'Brijesh Sharma': 'ALL', 'Nandre Burger': 'FAST', 'Dasun Shanaka': 'ALL', 'Donovan Ferreira': 'BAT',
    'Lhuan-dre Pretorius': 'WK', 'Ravi Bishnoi': 'SPIN', 'Sandeep Sharma': 'FAST',
    'Shubham Dubey': 'BAT', 'Sushant Mishra': 'FAST', 'Yash Punja': 'BAT',

    'Ashutosh Sharma': 'BAT', 'Auqib Nabi': 'FAST', 'Axar Patel': 'ALL', 'David Miller': 'BAT',
    'KL Rahul': 'WK', 'Kyle Jamieson': 'FAST', 'Lungi Ngidi': 'FAST', 'Madhav Tiwari': 'ALL',
    'Mukesh Kumar': 'FAST', 'Prithvi Shaw': 'BAT', 'Rishabh Pant': 'WK', 'Sameer Rizvi': 'BAT',
    'Tripurana Vijay': 'SPIN', 'Tristan Stubbs': 'BAT', 'Vipraj Nigam': 'ALL', 'Zeeshan Ansari': 'SPIN',

    'Shreyas Iyer': 'BAT', 'Marco Jansen': 'ALL', 'Marcus Stoinis': 'ALL', 'Hardik Pandya': 'ALL',
    'Shashank Singh': 'BAT', 'Prabhsimran Singh': 'BAT', 'Harpreet Brar': 'SPIN', 'Priyansh Arya': 'BAT',
    'Yuzvendra Chahal': 'SPIN', 'Harnoor Pannu': 'BAT', 'Azmatullah Omarzai': 'ALL', 'Yash Thakur': 'FAST',
    'V Vyshak': 'FAST', 'Vishnu Vinod': 'WK', 'Ben Dwarshuis': 'FAST', 'Cooper Connolly': 'ALL',
    'Musheer Khan': 'ALL', 'Xavier Bartlett': 'FAST', 'Suryansh Shedge': 'ALL',

    'Shubman Gill': 'BAT', 'Sai Sudharsan': 'BAT', 'Jos Buttler': 'WK', 'Gurnoor Brar': 'FAST',
    'R. Sai Kishore': 'SPIN', 'Mohammed Siraj': 'FAST', 'Washington Sundar': 'ALL', 'Rashid Khan': 'SPIN',
    'Kumar Kushagra': 'WK', 'Jayant Yadav': 'SPIN', 'Arshad Khan': 'ALL', 'Kagiso Rabada': 'FAST',
    'Prasidh Krishna': 'FAST', 'Jason Holder': 'ALL', 'Nishant Sindhu': 'ALL', 'Manav Suthar': 'SPIN',
    'Rahul Tewatia': 'ALL', 'Anuj Rawat': 'WK', 'Glenn Phillips': 'BAT', 'Ashok Sharma': 'FAST',
    'Harshal Patel': 'FAST', 'Tom Banton': 'BAT',

    'Abdul Samad': 'BAT', 'Digvesh Rathi': 'SPIN', 'Nicholas Pooran': 'BAT', 'Aiden Markram': 'BAT',
    'Josh Inglis': 'WK', 'Prince Yadav': 'FAST', 'Akash Singh': 'FAST', 'Kuldeep Yadav': 'SPIN',
    'Sam Curran': 'ALL', 'Akshat Raghuvanshi': 'BAT', 'Mayank Yadav': 'FAST', 'Shahbaz Ahmed': 'ALL',
    'Arjun Tendulkar': 'ALL', 'Mitchell Marsh': 'ALL', 'Arshin Kulkarni': 'ALL', 'Mohsin Khan': 'FAST',
    'Ayush Badoni': 'BAT', 'Mukul Choudhary': 'BAT',

    'Matt Henry': 'FAST', 'Matt Short': 'BAT', 'Zak Foulkes': 'ALL', 'Kuldip Yadav': 'FAST',
    'Prashant Veer': 'ALL', 'Macneil Noronha': 'BAT', 'Aman Khan': 'ALL', 'Spencer Johnson': 'FAST',
    'Akash Madhwal': 'FAST', 'Dian Forrester': 'ALL',
    'AM Ghazanfar': 'SPIN', 'Atharva Ankolekar': 'SPIN', 'Danish Malewar': 'BAT', 'Deepak Chahar': 'FAST',
    'Keshav Maharaj': 'SPIN', 'Mahipal Lomror': 'ALL', 'Mayank Markande': 'SPIN', 'Md. Izhar': 'FAST',
    'Robin Minz': 'WK', 'Trent Boult': 'FAST',
    'Mangesh Yadav': 'BAT', 'Jacob Bethell': 'ALL', 'Swapnil Singh': 'ALL', 'Richard Gleeson': 'FAST',
    'Matheesha Pathirana': 'FAST', 'Mustafizur Rahman': 'FAST', 'Rachin Ravindra': 'ALL',
    'Ajinkya Rahane': 'BAT', 'Akash Deep': 'FAST', 'Blessing Muzarbani': 'FAST', 'Navdeep Saini': 'FAST',
    'Rahul Tripathi': 'BAT', 'Umran Malik': 'FAST',
    'Travis Head': 'BAT', 'Gerald Coetzee': 'FAST', 'David Payne': 'FAST', 'Jaydev Unadkat': 'FAST',
    'Shivam Mavi': 'FAST', 'Kamindu Mendis': 'ALL', 'Dilshan Madushanka': 'FAST',
    'Tushar Deshpande': 'FAST', 'Adam Milne': 'FAST', 'Kuldeep Sen': 'FAST', 'Yudhvir Singh': 'FAST',
    'Kwena Maphaka': 'FAST', 'Vignesh Puthur': 'SPIN', 'Shimron Hetmyer': 'BAT',
    'Mitchell Starc': 'FAST', 'Nitish Rana': 'BAT', 'Abhishek Porel': 'WK', 'Pathum Nissanka': 'BAT',
    'Ben Duckett': 'BAT', 'Karun Nair': 'BAT', 'Dushmantha Chameera': 'FAST', 'Rehan Ahmed': 'ALL',
    'Ajay Mandal': 'ALL',
    'Nehal Wadhera': 'BAT', 'Mitchell Owen': 'ALL', 'Lockie Ferguson': 'FAST', 'Praveen Dubey': 'SPIN',
    'Shahrukh Khan': 'ALL', 'Ishant Sharma': 'FAST', 'Luke Wood': 'FAST', 'Kulwant Khejroliya': 'FAST',
    'Connor Esterhuizen': 'WK',
    'Avesh Khan': 'FAST', 'Anrich Nortje': 'FAST', 'Wanindu Hasaranga': 'ALL',
    'Matthew Breetzke': 'BAT', 'George Linde': 'ALL',

    'Ben Stokes': 'ALL', 'David Warner': 'BAT', 'Fazalhaq Farooqi': 'FAST',
    'Mujeeb Ur Rahman': 'SPIN', 'Rahmanullah Gurbaz': 'WK', 'Jake Fraser-McGurk': 'BAT',
    'Jhye Richardson': 'FAST', 'Mahli Beardman': 'FAST', 'Jonny Bairstow': 'WK',
    'Sam Billings': 'WK', 'Sonny Baker': 'FAST', 'Tom Curran': 'ALL',
    'Ben Sears': 'FAST', 'Bevon Jacobs': 'BAT', 'Daryl Mitchell': 'ALL',
    'Devon Conway': 'WK', 'Will O\'Rourke': 'FAST', 'Shai Hope': 'WK'
  };

  const TIER = {
    'Travis Head': 'A', 'Ajinkya Rahane': 'A', 'Mitchell Starc': 'A', 'Shimron Hetmyer': 'A',
    'Wanindu Hasaranga': 'A', 'Matheesha Pathirana': 'A', 'Pathum Nissanka': 'B',
    'Nitish Rana': 'B', 'Jacob Bethell': 'B', 'Deepak Chahar': 'B', 'Avesh Khan': 'B',
    'Mitchell Owen': 'B', 'Lockie Ferguson': 'B', 'Tushar Deshpande': 'B', 'Shahrukh Khan': 'B',
    'Rachin Ravindra': 'B', 'Mustafizur Rahman': 'B', 'AM Ghazanfar': 'B', 'Hardik Pandya': 'A',

    'Ben Stokes': 'A', 'David Warner': 'A', 'Jonny Bairstow': 'A', 'Daryl Mitchell': 'A',
    'Devon Conway': 'A', 'Shimron Hetmyer': 'A',
    'Fazalhaq Farooqi': 'B', 'Mujeeb Ur Rahman': 'B', 'Rahmanullah Gurbaz': 'B',
    'Jake Fraser-McGurk': 'B', 'Jhye Richardson': 'B', 'Mahli Beardman': 'C',
    'Sam Billings': 'B', 'Sonny Baker': 'C', 'Tom Curran': 'B', 'Ben Sears': 'C',
    'Bevon Jacobs': 'C', 'Will O\'Rourke': 'B', 'Shai Hope': 'B'
  };

  const playerMeta = {};
  new Set([...Object.keys(ROLE), ...OVERSEAS, ...Object.keys(TIER)]).forEach((name) => {
    playerMeta[name] = {
      role: ROLE[name] || 'BAT',
      country: OVERSEAS.has(name) ? 'OV' : 'IND',
      tier: TIER[name] || 'C'
    };
  });

  // Names visible in the supplied 2 Cr base-price list. These are treated as confirmed.
  const CONFIRMED_2CR = [
    'Avesh Khan', 'Deepak Chahar', 'Ben Stokes', 'David Warner', 'Fazalhaq Farooqi',
    'Mujeeb Ur Rahman', 'Rahmanullah Gurbaz', 'Jake Fraser-McGurk', 'Jhye Richardson',
    'Mahli Beardman', 'Spencer Johnson', 'Jonny Bairstow', 'Sam Billings', 'Sonny Baker',
    'Tom Curran', 'Adam Milne', 'Ben Sears', 'Bevon Jacobs', 'Daryl Mitchell',
    'Devon Conway', 'Rachin Ravindra', 'Trent Boult', 'Will O\'Rourke', 'Anrich Nortje',
    'Gerald Coetzee', 'Matheesha Pathirana', 'Wanindu Hasaranga', 'Shai Hope',
    'Shimron Hetmyer'
  ];

  // The rest of the released pool gets a clearly labelled estimated base until the final shortlist is public.
  const ESTIMATED_BASE_BY_TIER = { A: 2, B: 1, C: 0.5, D: 0.3 };

  // 18 names from the supplied image that were not in the published release lists.
  const EXTRA_RELEASED_2027 = [
    { name: 'Ben Stokes', team: 'DC' },
    { name: 'David Warner', team: 'RR' },
    { name: 'Fazalhaq Farooqi', team: 'MI' },
    { name: 'Mujeeb Ur Rahman', team: 'KKR' },
    { name: 'Rahmanullah Gurbaz', team: 'DC' },
    { name: 'Jake Fraser-McGurk', team: 'DC' },
    { name: 'Jhye Richardson', team: 'CSK' },
    { name: 'Mahli Beardman', team: 'MI' },
    { name: 'Jonny Bairstow', team: 'DC' },
    { name: 'Sam Billings', team: 'RR' },
    { name: 'Sonny Baker', team: 'CSK' },
    { name: 'Tom Curran', team: 'CSK' },
    { name: 'Ben Sears', team: 'MI' },
    { name: 'Bevon Jacobs', team: 'LSG' },
    { name: 'Daryl Mitchell', team: null },
    { name: 'Devon Conway', team: 'CSK' },
    { name: 'Will O\'Rourke', team: null },
    { name: 'Shai Hope', team: null }
  ];

  const SEASONS = {
    '2025': {
      id: '2025',
      label: '2025 Mega Auction',
      short: '2025',
      tagline: '7 real sets · ₹120 Cr purse · RTM cards',
      purse: 120,
      squadCap: 25,
      overseasCap: 8,
      rtm: true,
      prizeMoney: { champion: 20, runnerUp: 12.5, third: 7, fourth: 6.5 },
      prizeLabel: 'Real IPL 2025 team prize money'
    },
    '2027': {
      id: '2027',
      label: '2027 Mini Auction',
      short: '2027',
      tagline: '16 Dec 2026 · Goa · 66 slots · no RTM',
      purse: 130,
      squadCap: 25,
      overseasCap: 8,
      rtm: false,
      date: '16 Dec 2026',
      venue: 'ITC Grand Goa',
      prizeMoney: { champion: 20, runnerUp: 13, third: 7, fourth: 6.5 },
      prizeLabel: 'Current IPL team prize money',
      teams: {
        CSK: { purse: 28.05, slots: 6, overseas: 2 },
        DC: { purse: 39.5, slots: 9, overseas: 4 },
        GT: { purse: 8.75, slots: 3, overseas: 2 },
        KKR: { purse: 41.65, slots: 8, overseas: 3 },
        LSG: { purse: 47.45, slots: 7, overseas: 3 },
        MI: { purse: 32.6, slots: 9, overseas: 2 },
        PBKS: { purse: 18.6, slots: 6, overseas: 2 },
        RR: { purse: 27.05, slots: 6, overseas: 3 },
        RCB: { purse: 14.15, slots: 5, overseas: 1 },
        SRH: { purse: 40.15, slots: 7, overseas: 3 }
      },
      retained: {
        CSK: ['Ruturaj Gaikwad', 'Sanju Samson', 'Kartik Sharma', 'Urvil Patel', 'Sarfaraz Khan', 'Ayush Mhatre', 'Dewald Brevis', 'Noor Ahmad', 'Akeal Hosein', 'Mukesh Choudhary', 'Jamie Overton', 'Shivam Dube', 'Ramakrishna Ghosh', 'Gurjapneet Singh', 'Anshul Kamboj', 'Shreyas Gopal', 'Rahul Chahar'],
        DC: ['Ashutosh Sharma', 'Auqib Nabi', 'Axar Patel', 'David Miller', 'KL Rahul', 'Kyle Jamieson', 'Lungi Ngidi', 'Madhav Tiwari', 'Mukesh Kumar', 'Prithvi Shaw', 'Rishabh Pant', 'Sameer Rizvi', 'Tripurana Vijay', 'Tristan Stubbs', 'Vipraj Nigam', 'Zeeshan Ansari'],
        GT: ['Shubman Gill', 'Sai Sudharsan', 'Jos Buttler', 'Gurnoor Brar', 'R. Sai Kishore', 'Mohammed Siraj', 'Washington Sundar', 'Rashid Khan', 'Kumar Kushagra', 'Jayant Yadav', 'Arshad Khan', 'Kagiso Rabada', 'Prasidh Krishna', 'Jason Holder', 'Nishant Sindhu', 'Manav Suthar', 'Rahul Tewatia', 'Anuj Rawat', 'Glenn Phillips', 'Ashok Sharma', 'Harshal Patel', 'Tom Banton'],
        KKR: ['Angkrish Raghuvanshi', 'Anukul Roy', 'Cameron Green', 'Finn Allen', 'Harshit Rana', 'Kartik Tyagi', 'Manish Pandey', 'Prashant Solanki', 'Ramandeep Singh', 'Rinku Singh', 'Rovman Powell', 'Sarthak Ranjan', 'Saurabh Dubey', 'Sunil Narine', 'Tim Seifert', 'Vaibhav Arora', 'Varun Chakaravarthy'],
        LSG: ['Abdul Samad', 'Digvesh Rathi', 'Nicholas Pooran', 'Aiden Markram', 'Josh Inglis', 'Prince Yadav', 'Akash Singh', 'Kuldeep Yadav', 'Sam Curran', 'Akshat Raghuvanshi', 'Mayank Yadav', 'Shahbaz Ahmed', 'Arjun Tendulkar', 'Mitchell Marsh', 'Arshin Kulkarni', 'Mohsin Khan', 'Ayush Badoni', 'Mukul Choudhary'],
        MI: ['Arshdeep Singh', 'Ashwani Kumar', 'Corbin Bosch', 'Jasprit Bumrah', 'Mitchell Santner', 'Naman Dhir', 'Quinton de Kock', 'Raghu Sharma', 'Raj Angad Bawa', 'Rohit Sharma', 'Ryan Rickelton', 'Shardul Thakur', 'Sherfane Rutherford', 'Suryakumar Yadav', 'Tilak Varma', 'Will Jacks'],
        PBKS: ['Shreyas Iyer', 'Marco Jansen', 'Marcus Stoinis', 'Hardik Pandya', 'Shashank Singh', 'Prabhsimran Singh', 'Harpreet Brar', 'Priyansh Arya', 'Yuzvendra Chahal', 'Harnoor Pannu', 'Azmatullah Omarzai', 'Yash Thakur', 'V Vyshak', 'Vishnu Vinod', 'Ben Dwarshuis', 'Cooper Connolly', 'Musheer Khan', 'Xavier Bartlett', 'Suryansh Shedge'],
        RR: ['Riyan Parag', 'Yashasvi Jaiswal', 'Vaibhav Sooryavanshi', 'Ravindra Jadeja', 'Dhruv Jurel', 'Jofra Archer', 'Aman Rao Perala', 'Brijesh Sharma', 'Nandre Burger', 'Dasun Shanaka', 'Donovan Ferreira', 'Lhuan-dre Pretorius', 'Ravi Bishnoi', 'Sandeep Sharma', 'Shubham Dubey', 'Sushant Mishra', 'Yash Punja'],
        RCB: ['Abhinandan Singh', 'Kanishk Chouhan', 'Suyash Sharma', 'Bhuvneshwar Kumar', 'Krunal Pandya', 'Tim David', 'Devdutt Padikkal', 'Nuwan Thushara', 'Venkatesh Iyer', 'Jacob Duffy', 'Phil Salt', 'Vicky Ostwal', 'Jitesh Sharma', 'Rajat Patidar', 'Virat Kohli', 'Jordan Cox', 'Rasikh Dar', 'Yash Dayal', 'Josh Hazlewood', 'Romario Shepherd'],
        SRH: ['Pat Cummins', 'Abhishek Sharma', 'Ishan Kishan', 'Heinrich Klaasen', 'Nitish Kumar Reddy', 'Brydon Carse', 'Salil Arora', 'Aniket Verma', 'Harsh Dubey', 'Smaran Ravichandran', 'Praful Hinge', 'Sakib Hussain', 'Shivang Kumar', 'Krans Fuletra', 'Eshan Malinga']
      },
      released: {
        CSK: ['Matt Henry', 'Matt Short', 'Zak Foulkes', 'Kuldip Yadav', 'Prashant Veer', 'Macneil Noronha', 'Aman Khan', 'Spencer Johnson', 'Akash Madhwal', 'Dian Forrester'],
        DC: ['Mitchell Starc', 'Nitish Rana', 'Abhishek Porel', 'Pathum Nissanka', 'Ben Duckett', 'Karun Nair', 'Sahil Parakh', 'Dushmantha Chameera', 'Rehan Ahmed', 'Ajay Mandal'],
        GT: ['Shahrukh Khan', 'Ishant Sharma', 'Luke Wood', 'Kulwant Khejroliya', 'Prithviraj Yarra', 'Connor Esterhuizen'],
        KKR: ['Matheesha Pathirana', 'Mustafizur Rahman', 'Tejasvi Singh Dahiya', 'Rachin Ravindra', 'Ajinkya Rahane', 'Akash Deep', 'Blessing Muzarbani', 'Navdeep Saini', 'Rahul Tripathi', 'Umran Malik', 'Daksh Kamra', 'Luvinith Sisodia'],
        LSG: ['Avesh Khan', 'Anrich Nortje', 'Wanindu Hasaranga', 'Matthew Breetzke', 'George Linde', 'Naman Tiwari', 'Arshin Kulkarni'],
        MI: ['AM Ghazanfar', 'Atharva Ankolekar', 'Danish Malewar', 'Deepak Chahar', 'Hardik Pandya', 'Keshav Maharaj', 'Krish Bhagat', 'Mahipal Lomror', 'Mayank Markande', 'Mayank Rawat', 'Md. Izhar', 'Robin Minz', 'Ruchit Ahir', 'Trent Boult'],
        PBKS: ['Nehal Wadhera', 'Mitchell Owen', 'Lockie Ferguson', 'Pyla Avinash', 'Praveen Dubey', 'Vishal Nishad'],
        RR: ['Tushar Deshpande', 'Adam Milne', 'Kuldeep Sen', 'Yudhvir Singh', 'Kwena Maphaka', 'Vignesh Puthur', 'Shimron Hetmyer', 'Ravi Singh', 'Emanjot Singh Chahal'],
        RCB: ['Mangesh Yadav', 'Jacob Bethell', 'Swapnil Singh', 'Satvik Deswal', 'Vihaan Malhotra', 'Richard Gleeson'],
        SRH: ['Travis Head', 'Gerald Coetzee', 'David Payne', 'Jaydev Unadkat', 'Shivam Mavi', 'Kamindu Mendis', 'Dilshan Madushanka', 'Onkar Tarmale', 'Amit Kumar']
      },
      playerMeta,
      confirmedBasePlayers: CONFIRMED_2CR,
      estimatedBaseByTier: ESTIMATED_BASE_BY_TIER,
      extraReleased: EXTRA_RELEASED_2027,
      baseNote: '29 names from the supplied image are confirmed at ₹2 Cr base. All other released players have an estimated base until the final shortlist is published.'
    }
  };

  root.IPL_SEASONS = SEASONS;
  if (typeof module !== 'undefined' && module.exports) module.exports = SEASONS;
})(typeof window !== 'undefined' ? window : globalThis);
