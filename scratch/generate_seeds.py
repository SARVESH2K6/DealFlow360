import random
import uuid

# --- Data ---
companies = [
    ("3k it solutions", "Ahmedabad"), ("Ace Data Analytics", "Ahmedabad"), ("BRIGHTFORCE TECHNOLOGIES PVT LTD", "Ahmedabad"), 
    ("Cerebulb India pvt ltd", "Gandhinagar"), ("CHPL", "Ahmedabad"), ("Rdflex", "Gandhinagar"), 
    ("Excelsior Technologies", "Ahmedabad"), ("Huptech Web Pvt. Ltd.", "Ahmedabad"), ("QriousTech", "Ahmedabad"), 
    ("Kiara TechX", "Ahmedabad"), ("Latitude Technolabs Private Limited", "Ahmedabad"), ("Magnusminds IT solutions", "Ahmedabad"), 
    ("MV Clouds", "Ahmedabad"), ("Petpooja", "Ahmedabad"), ("Preplegit Global Private Limited", "Ahmedabad"), 
    ("Ridgeant Technologies", "Ahmedabad"), ("Sanskar Technolab", "Ahmedabad"), ("Saturn cube Technologies", "Ahmedabad"), 
    ("SharkStriker Pvt Ltd", "Ahmedabad"), ("SilverXis LLP", "Ahmedabad"), ("Sixsigma Technosoft", "Ahmedabad"), 
    ("Technman Consulting pvt ltd", "Ahmedabad"), ("Thinkwik", "Ahmedabad"), ("Top notch", "Ahmedabad"), 
    ("Tracomo cameras and automation", "Ahmedabad"), ("Weboshere", "Ahmedabad"), ("Xcess Technologies", "Ahmedabad"), 
    ("Yudiz solution Limited", "Ahmedabad"), ("Actowiz Solution", "Ahmedabad"), ("Techccare digisol pvt.ltd.", "Rajkot"), 
    ("TechMonarch", "Ahmedabad"), ("Aasma Technology Solutions", "Ahmedabad"), ("AAVISHKURTI SOLUTION", "Ahmedabad"), 
    ("Abaj Frontendz", "Gandhinagar"), ("Ace infoway", "Ahmedabad"), ("Adopt nettech", "Ahmedabad"), 
    ("Advitya Solutions", "Ahmedabad"), ("Agendeas Solution LLP", "Rajkot"), ("Alisys", "Himatnagar"), 
    ("Alliedge Technologies", "Ahmedabad"), ("Ananta Solution", "Ahmedabad"), ("AONE SEO SERVICE PVT LTD", "Ahmedabad"), 
    ("APP GALLARY", "Ahmedabad"), ("Ark infosoft", "Ahmedabad"), ("Aruhat Technology", "Ahmedabad"), 
    ("AutoDx", "Ahmedabad"), ("B Creative Solutions", "Ahmedabad"), ("Bigscal solution Pvt Ltd", "Surat"), 
    ("BirajTech Services", "Ahmedabad"), ("BMV System Integration", "Ahmedabad"), ("Boldteq", "Rajkot"), 
    ("Bonrix", "Ahmedabad"), ("Brahma Technolab", "Ahmedabad"), ("Brainsquare Technologies", "Ahmedabad"), 
    ("Brainy Beam", "Ahmedabad"), ("Brand Height", "Ahmedabad"), ("Brilworks tecnology pvt.", "Ahmedabad"), 
    ("CandidRoot Solutions", "Ahmedabad"), ("Close digit", "Ahmedabad"), ("Codage Habitation", "Ahmedabad"), 
    ("Codetech IT Solutions Pvt Ltd", "Hyderabad"), ("CODEZEROS", "Ahmedabad"), ("Codsoft", "Kolkata"), 
    ("Codtech it solutions", "Hyderabad"), ("COGNIFYZ TECHNOLOGIES", "Nagpur"), ("commerciax.com", "Ahmedabad"), 
    ("Concatstring", "Ahmedabad"), ("Crawl Magic Solution", "Ahmedabad"), ("CrawlMagic Solution", "Ahmedabad"), 
    ("Creative infoway", "Ahmedabad"), ("Deendayal port authority", "Gandhidham"), ("Delta Infosoft Pvt. Ltd.", "Ahmedabad"), 
    ("Demmisto Technology Pvt Ltd", "Ahmedabad"), ("Dev Information Technology Limited", "Ahmedabad"), ("Dev It", "Ahmedabad"), 
    ("ELLKAY", "Ahmedabad"), ("eMatrix Info tech pvt.ltd", "Ahmedabad"), ("Emerging five", "Ahmedabad"), 
    ("ENTERPRISE ANALYTICS", "Ahmedabad"), ("EPROCUREMENT TECHNOLOGIES", "Ahmedabad"), ("Evolvision Technologies", "Ahmedabad"), 
    ("Evrig Solutions", "Ahmedabad"), ("Exceleur Services", "Ahmedabad"), ("Exosoft It Solutions", "Surat"), 
    ("FAHM Technology", "Ahmedabad"), ("Felix-It systems", "Ahmedabad"), ("Folium infotech pvt ltd", "Ahmedabad"), 
    ("ForeTeach", "Ghaziabad"), ("Furrisic infotech", "Ahmedabad"), ("G future", "Ahmedabad"), 
    ("Gamma Byte Technology", "Ahmedabad"), ("GANGOUR GAURA FMS PVT LTD", "Udaipur"), ("Grownited Private Limited", "Ahmedabad"), 
    ("Gujarat infotech limited", "Ahmedabad"), ("Gurukrupa Enterprise", "Ahmedabad"), ("Happiness Solutions pvt. Ltd.", "Ahmedabad"), 
    ("HASHMOB TECHNOLOGIES", "Surat"), ("Hidden Brains", "Ahmedabad"), ("Humbee Studios", "Ahmedabad"), 
    ("Hypx", "Ahmedabad"), ("Icecube digital", "Ahmedabad"), ("iGauri Solutions Pvt. Ltd", "Ahmedabad"), 
    ("Infynno Solutions LLP", "Ahmedabad"), ("Innovatewebtech", "Ahmedabad"), ("Innovatiq", "Kalol"), 
    ("Intellial Solutions Pvt Ltd", "Ahmedabad"), ("Interactive Warriors Studio Pvt Ltd", "Ahmedabad"), ("iSageBrum Technologies Pvt Ltd", "Ahmedabad"), 
    ("Junkies Coder", "Himatnagar"), ("Kali Infotech", "Surat"), ("Kanzariya Technology Private Limited", "Rajkot"), 
    ("Karbh It solution", "Ahmedabad"), ("KARMANYE TECH LLP", "Surat"), ("Kashtbhanjan Digital", "Ahmedabad"), 
    ("Keshav Infotech", "Rajkot"), ("Launch pad", "Ahmedabad"), ("League Sports Co.", "Delhi"), 
    ("Linearloop", "Ahmedabad"), ("LiveBird Technologies Pvt. Ltd.", "Ahmedabad"), ("Log Binary", "Ahmedabad"), 
    ("LogicalStreet technology pvt ltd", "Ahmedabad"), ("LogicRays", "Ahmedabad"), ("LOGILITE TECHNOLOGIES", "Ahmedabad"), 
    ("Madvise Infotech", "Surat"), ("Mahavir buisness solutions", "Ahmedabad"), ("Manarsh Technologies", "Surat"), 
    ("Manektech", "Ahmedabad"), ("Maxgen Technologies", "Ahmedabad"), ("MBJ TECHNOLABS", "Ahmedabad"), 
    ("Mct it solution", "Ahmedabad"), ("MD Technosoft", "Ahmedabad"), ("Mobile first application pvt ltd", "Ahmedabad"), 
    ("Mototive web solution", "Ahmedabad"), ("Movya infotech", "Ahmedabad"), ("Moweb", "Ahmedabad"), 
    ("Nichetech solution pvt ltd", "Ahmedabad"), ("NikSan Tech", "Ahmedabad"), ("NIVIC TECH VISION", "Ahmedabad"), 
    ("Notionmind", "Ahmedabad"), ("NR Crew", "Ahmedabad"), ("Nyrow tech", "Rajkot"), 
    ("Oceanmtech Private Limited", "Ahmedabad"), ("Oreus Solution LLP", "Anjar"), ("PEDALS UP", "Ahmedabad"), 
    ("PENTEST PORTLINKS INDIA Pvt.Ltd", "Gandhidham"), ("Percept Infotech", "Ahmedabad"), ("PIXIVERSE TECHNOLOGY", "Ahmedabad"), 
    ("Prakash Industries", "Ahmedabad"), ("PRIMOCYS", "Ahmedabad"), ("Prowess", "Ahmedabad"), 
    ("PSK technology", "Surat"), ("QUBA INFOTECH", "CHHAPI"), ("Quickint Solutions", "Ahmedabad"), 
    ("Raj Barcode Systems Pvt Ltd", "Ahmedabad"), ("Raj fasteners", "Ahmedabad"), ("Rapidops", "Ahmedabad"), 
    ("Rayo Innovations", "Ahmedabad"), ("Rays techserv pvt", "Ahmedabad"), ("Riveredge analytics pvt ltd", "Ahmedabad"), 
    ("Sahal Softech", "Ahmedabad"), ("Saimej infosens", "Dholka"), ("Samvaaya Services", "Ahmedabad"), 
    ("Sattrix information security", "Ahmedabad"), ("SculptSoft Private Limited", "Ahmedabad"), ("Sigzen technologies", "Ahmedabad"), 
    ("Silver Sky Technology", "Ahmedabad"), ("SocialPilot", "Ahmedabad"), ("Softcolon technologies", "Ahmedabad"), 
    ("Software Technology Works Inc.", "Ahmedabad"), ("Solwhizz Innovations", "Ahmedabad"), ("Sparks to ideas", "Ahmedabad"), 
    ("Spellbound soft solutions", "Ahmedabad"), ("Srashta soft", "Ahmedabad"), ("ST Lab", "Bhavnagar"), 
    ("Sustainable knitting", "Ahmedabad"), ("synoris", "Surat"), ("Tally solutions", "Bangalore"), 
    ("Tarrakki", "Ahmedabad"), ("TDL HACKER'S CLUB", "Ahmedabad"), ("TECH BUILDERS", "Ahmedabad"), 
    ("TechEniac", "Ahmedabad"), ("Techgroot", "Ahmedabad"), ("Technical Core Engineers", "Ahmedabad"), 
    ("Techno it hub", "Ahmedabad"), ("TechnoAdviser", "Ahmedabad"), ("TECORENG", "Ahmedabad"), 
    ("Tesseract Technolabs", "Ahmedabad"), ("Testa Outsourcing Service", "Ahmedabad"), ("Texowave Private limited", "Ahmedabad"), 
    ("The dezine", "Ahmedabad"), ("The Internet Company", "Chennai"), ("Theta technolabs", "Ahmedabad"), 
    ("Thinknovus technologies", "Ahmedabad"), ("Tridhya tech", "Ahmedabad"), ("Tupple apps", "Surat"), 
    ("Tuvoc technologies pvt ltd", "Ahmedabad"), ("TUVOC technology", "Ahmedabad"), ("UNIQUE IT SOLUTION", "Ahmedabad"), 
    ("Vahlay Consulting", "Ahmedabad"), ("Veb builders Technology", "Ahmedabad"), ("Viewebit", "Ahmedabad"), 
    ("Vikartr Technologies", "Gandhinagar"), ("VIPL", "Ahmedabad"), ("Volansys Technologies", "Ahmedabad"), 
    ("Vrinsoft technology pvt Ltd", "Ahmedabad"), ("WanBuffer Services", "Ahmedabad"), ("Warlock Technologies Pvt Ltd", "Gandhinagar"), 
    ("Webdesk solution pvt ltd", "Ahmedabad"), ("Webify.ai", "Ahmedabad"), ("WebMob Technologies pvt ltd", "Ahmedabad"), 
    ("WEDOWEBAPPS", "Ahmedabad"), ("World web technology", "Ahmedabad"), ("Xylisys Solutions Private Limited", "Ahmedabad"), 
    ("Yellow Panther", "Ahmedabad"), ("Yeris Resources LLP", "Ahmedabad"), ("York IE", "Ahmedabad"), 
    ("Zbox Technologies", "Ahmedabad"), ("Zeronsec", "Junagadh"), ("Zignuts technolab", "Gandhinagar"), 
    ("Zylitix Solutions Pvt. Ltd.", "Ahmedabad")
]

employees = [
    "AMAN PAL", "BERA HET KISHORBHAI", "BHUVA DHARMAN KISHORBHAI", "BOGHANI ANKUSH KANUBHAI", "DANDAWALA YUG SANJAYBHAI", 
    "DELVADIYA PARTH SANJAYKUMAR", "DODIYA MAYUR HASMUKHBHAI", "GAJERA ABHI BHADRESHBHAI", "GAJERA FENIL MAHESHBHAI", "GEDIYA PRINCE BABUBHAI", 
    "HUNANI ADIL VAHIDBHAI", "JAIN TARUN SUDHIRKUMAR", "RATHOD JAY RITESH", "JETHVA JEET ATULBHAI", "KAPADIYA ABHI PARESHBHAI", 
    "KAVYA HITESH PANDYA", "KHENI PARTHIV SURESHBHAI", "MAKWANA DIVYANSH VALJIBHAI", "MEHTA MEET VIKRANT", "PADASANA SHARMILKUMAR BHARATBHAI", 
    "PADMANI KRISH VIPULBHAI", "PANCHAL DEV SACHINKUMAR", "PANCHAL NITYAKUMAR ALPESHKUMAR", "PANDYA VEER RANTIK", "PATEL DEV UDAYKUMAR", 
    "PATEL HONEY HASMUKHBHAI", "PATEL JOY MANOJKUMAR", "PATEL PRIYANSHU RAMASRE", "PATEL TRISHA DINESHKUMAR", "POLARA NISHANT MAHENDRABHAI", 
    "PRAJAPATI JAINAM ISHWARBHAI", "PRAJAPATI JAYESH PRAKASHBHAI", "PRAJAPATI OM MITESH", "PRAJAPATI ZEELKUMAR MUKESHBHAI", "RAKHOLIYA PRIYANG ASHOKBHAI", 
    "ROKAD AAYUSH HITESHBHAI", "RUDRAKSH PARIKH", "SATVIK PARIHAR", "SHARMA DHRUVKUMAR ARVINDKUMAR", "SHUKLA SHIVAM RAJIV", 
    "TARPARA HARSH PRAKASHBHAI", "VAGHASIYA IKSHIT MUKESHBHAI", "VIROJA SMIT RASIKBHAI", "ZALA DHRUVRAJSINH KRIPALSINH", "BADGUJAR MOHIT PANKAJKUMAR", 
    "HET BHATT", "BHIKADIYA OM MAHESHBHAI", "BUNHA MEET DINESHBHAI", "DEEP MAHESHBHAI CHOVATIYA", "JOSHI PARTHKUMAR GIRISHBHAI", 
    "KANANI ROHANKUMAR VALLABHBHAI", "KHATRI VRAJ PIYUSHKUMAR", "MANSURI ABDULLAH JAVEDBHAI", "TIRTHKUMAR AMRISH PATEL", "SMIT CHIRAGBHAI PRAJAPATI", 
    "RAMANUJ BHAVYA UMANGBHAI", "RATHOD VISHAL", "RATHOD YASH DILIPBHAI", "SHUBHAM MAHESHBHAI SAKARIYA", "SHAH MEET PARASBHAI", 
    "SHAH MOKSHEET SHREYASKUMAR", "SHAH PREET HITESHKUMAR", "SHAH SHUBHAM BIPINKUMAR", "TIRTH HIMANSHUBHAI SHAH", "SHAH VRAJ TUSHARKUMAR", 
    "SHELADIYA HARSH", "HET THESIYA", "VAIDYA YOGANSHU VIRENBHAI", "VIRJA DEEP BHARATBHAI", "VORA MAHAMMADKAIF", 
    "BHANGADIYA YASH PARSOTAMBHAI", "BORICHA JAINAM VIJAYKUMAR", "CHUDASAMA HIMANI DHARMESHBHAI", "JANI YATHARTH KAMALBHAI", "JESADIYA MANAVKUMAR PARESHBHAI", 
    "KAILA KRISHKUMAR VINODBHAI", "KAPIL BUDHANI", "KHUNT UMANGKUMAR PARESHBHAI", "KOSHIYA YUGKUMAR PRAVINCHANDRA", "MACHCHHAR FARHAN IMTIYAZ", 
    "MANGUKIYA PUJAN SANJAYBHAI", "MISHRA OM SANDHYA", "MORKHIYA DEVPRIYA DINESHKUMAR", "NAKRANI KRUSHA NILESHBHAI", "NAKRANI PARTHIV OMKARBHAI", 
    "PARMAR DEV LALITKUMAR", "PATEL KAVYA NARESHKUMAR", "PATEL NIRAV VASUDEVBHAI", "POPAT MEET RAJESHBHAI", "SAVALIYA YUGKUMAR MEHULBHAI", 
    "SHAIL KIRAN PATEL", "THAKKAR VEER KANAIYALAL", "TRIVEDI JEET SANTOSHKUMAR", "YADAV KAVYA HARIPRASAD", "YASH CHAUHAN", 
    "CHAVDA KAVANKUMAR", "KRUSHILBHAI KANJIBHAI DESAI", "DEVAL AAL", "DOMADIYA SHYAM KALPESHBHAI", "GANGADIYA MEET DIPAKBHAI", 
    "GHANCHI AAMIL SARFARAJ", "HARYANI JANVI JAGDISHKUMAR", "HUZEFA MURTUJA ANANDWALA", "HITEN JAGAD", "JETHWA JAY PANKAJ", 
    "ADITYA KADIA", "KADRI AASIM ALTAFHUSEN", "KATHIRIYA GAURAVKUMAR RAMESHBHAI", "KHUNT KRUSHAL", "KRISH PATEL", 
    "KRISHIT SHAH", "MANAV KOTADIA", "MANSURI HAARIS ANISBHAI", "MANSURI MOHAMMAD ANAS MOHAMMAD IDRIS", "MARAND URMIK", 
    "MITANSHU GAUTAMBHAI PATEL", "NAGAR MEET JAYESHKUMAR", "AAMENA SALIM PALA", "PANCHAL SMIT SUNILBHAI", "DWIJ PANDYA", 
    "PATEL NAISARGI PRATHMESHKUMAR", "PATEL VIRAJ CHETNABEN", "JIGAR PAUN", "PEAL ANKHIWALA", "MADHUR POPAT", 
    "PRAGATI PRAJAPATI", "SANGANI KRISH KAMLESH", "SHAH DRASHTI DHAVALKUMAR", "SHAH PARTH", "SHAIKH MOHAMMED NABIL", 
    "SHAIKH SARIYAH", "OM JITENDRAKUMAR SONAGARA", "THAKKAR ANKIT CHINUBHAI", "THAKKAR DIVYA JAIMIN", "HET THAKKAR", 
    "TRIVEDI DHARMIK", "TRIVEDI NISARG", "ABHISHEK VATALIYA", "DHRUV RAJESHBHAI VITHALANI", "KATHIRIYA VRAJKUMAR ASHVINBHAI", 
    "AGRAVAT SAHIL RAJARAMBHAI", "BALAR RAGHUBHAI SURESHBHAI", "BALESANA HASSANBHAI YUNUSBHAI", "BAMBHROLIYA HIT NARESHBHAI", "BHADANI JAY NITESHBHAI", 
    "BHALALA PRINCE ARVINDBHAI", "BHANDERI NIHANSHU ATULBHAI", "BHARMAL TASNEEM SHABBIRBHAI", "BHATIYA KAVYA NILESHKUMAR", "BHATT MAHARSHI JIGNESHBHAI", 
    "BHATT VATSAL RAKESH", "BHAVSAR JAINAM MINESHKUMAR", "BHAVYA BHANDERI", "BHIMANI BHAVIK GUNVANTBHAI", "BHIMANI DHRUVIN MUKESHBHAI", 
    "BHUT MIRAJ NITINBHAI", "BHUT SAVAN JAYESHKUMAR", "CHACHADIYA VISHRUTI UMEDBHAI", "CHAUDHARI SANIKUMAR BABUBHAI", "CHAUDHARY VARUNKUMAR RUPABHAI", 
    "CHAUHAN ANSH RAKESHKUMAR", "CHAUHAN PARTHIVI MITHILESH", "CHAUHAN UDAY RAMKYASH", "CHHAPIYA PRIYANSH BHUPENDRAKUMAR", "CHHATRODIYA NISHANT MALDEBHAI", 
    "CHOVATIYA TIRTHKUMAR NITINBHAI", "CHUDASAMA ASHUTOSH JASVANTBHAI", "DALAL MOHAMMED AAKIFKHAN MOHAMMED SAKIBKHAN", "DEDAKIYA FENIL RAKESHBHAI", "DEVANI HARSHIL HARESHBHAI", 
    "DHOL VASU SURESHBHAI", "DHRUVE SUJAL AMITBHAI", "DODIYA NIKHAR JITENDRABHAI", "DONGA RAJ BHUPATBHAI", "DOSHI BHAVYA KETANKUMAR", 
    "DOSHI HITARTH DEVANGBHAI", "DOSHI RUSHVI VIRALKUMAR", "DWIVEDI SIDDHARTH ASHISH", "GAJERA VRAJ PARSHOTTAMBHAI", "GANDHI HIYA HIRENBHAI", 
    "GHADIYA MOHIT ASHOKBHAI", "GHODASARA DHARMIKKUMAR BALUBHAI", "GOHEL DHRUVI HIRENBHAI", "GONDALIYA NIRBHAY ASHWINBHAI", "GORASIYA VIVEK NARSHIBHAI", 
    "GOYANI KHILAN SANJAYBHAI", "GUPTA TULSHI PANKAJ", "HIRANI PRIYA RAMESHCHANDRA", "JADAV PARTHBHAI PRAVINBHAI", "JADAV SMITKUMAR GHANSHYAMBHAI", 
    "JALGARIYA DEEP BHANUBHAI", "JANI SAUMYA DARSHANBHAI", "JESANI SURESH RAMESH", "JOSHI VEDANT KISHOR", "KACHHADIYA KRISH JITENDRABHAI", 
    "KACHHADIYA MIT VAJUBHAI", "KADIA SMIT HITESH", "KAKADIYA DHARMIT ALPESHBHAI", "KANANI PRAYAG RAJUBHAI", "KANANI PRINCE RAJESHBHAI", 
    "KANERIYA PARV DEVENDRABHAI", "KAPADIYA KRISH PRADIPKUMAR", "KAPADIYA PRIYAMKUMAR MUKESHBHAI", "KAPUPARA HASTI RAKESHBHAI", "KARIA AYUSH HIMANSHUBHAI", 
    "KASODARIYA JAINIL AASHISHBHAI", "KHOYANI SAVAN KETANBHAI", "KORI NITIN DINESH", "KOTHARI DEVARSH MANAKKUMAR", "KUMAWAT NISHIT DUSHYENT", 
    "KUNAL FAUZDAR", "LALJANI JAY MUKESH", "LOKHANDWALA QASIM HUSSEIN", "MAHERIYA PARTHBHAI HEMANTBHAI", "MAHETA HET POONAMKUMAR", 
    "MAIYANI RAHIL NARESHBHAI", "MAKWANA PRIYANSHU GIRISHCHANDRA", "MANDANKA KEVAL VIMALBHAI", "MARGISH PADALIYA", "MARU ANJALI RAMASHIBHAI", 
    "MASRANI KASAK ATULBHAI", "MEET VIPULBHAI BUTANI", "MEGH RAMESHKUMAR MATHOLIA", "MEHTA BHAVYA VISHALKUMAR", "MEHTA KEYUR VIPULBHAI", 
    "MEMON SOHAIL SALIM", "MEVADA MANAN SHAILESHBHAI", "MISTRY ANJALI KALPESHBHAI", "MISTRY DHRUVI PARESH", "MISTRY JAY RAMESHBHAI", 
    "MISTRY KAHAN HIREN", "MOGHARIYA ARYANKUMAR NAROTTAMBHAI", "MOMIN MARIYAMFATEMA ABIDALI", "MORI VISHVAJEET DIPAKBHAI", "MUNDHAVA MAHENDRA VALABHAI"
]

def generate_sql():
    sql = "-- =============================================================================\n"
    sql += "-- NEW SEEDS FOR DEALFLOW360 (Extracted from PDFs)\n"
    sql += "-- =============================================================================\n\n"

    # Clear previously generated data to prevent duplicate key errors
    sql += "-- --- Cleanup previously generated data ---\n"
    sql += "DELETE FROM users WHERE id LIKE 'u-gen-%' OR id LIKE 'u-cust-gen-%';\n"
    sql += "DELETE FROM customers WHERE id LIKE 'c-gen-%';\n\n"

    # Customers
    sql += "-- --- Customers ---\n"
    tiers = ['Bronze', 'Silver', 'Gold']
    terms = ['Net 15', 'Net 30', 'Net 45']
    
    for i, (name, city) in enumerate(companies):
        c_id = f"c-gen-{i+1}"
        tier = random.choice(tiers)
        term = random.choice(terms)
        sql += f"INSERT INTO customers (id, name, tier, region, terms) VALUES ('{c_id}', '{name.replace(chr(39), '')}', '{tier}', '{city}', '{term}');\n"

    sql += "\n-- --- Users (Employees) ---\n"
    
    roles = []
    # 250 employees: majority sales rep > manager > finance
    # Let's say: 150 reps, 60 managers, 40 finance
    for _ in range(150): roles.append('rep')
    for _ in range(60): roles.append('manager')
    for _ in range(40): roles.append('finance')
    
    for i, name in enumerate(employees):
        u_id = f"u-gen-{i+1}"
        role = roles[i] if i < len(roles) else 'rep'
        email = f"emp{i+1}.{name.split(' ')[0].lower()}@example.com"
        sql += f"INSERT INTO users (id, email, password, name, role, customer_id) VALUES ('{u_id}', '{email}', 'password', '{name.title()}', '{role}', NULL);\n"

    sql += "\n-- --- Users (Customers) ---\n"
    for i, (name, _) in enumerate(companies):
        c_id = f"c-gen-{i+1}"
        u_id = f"u-cust-gen-{i+1}"
        domain_name = name.replace(' ', '').replace('.', '').replace(',', '').replace(chr(39), '').lower()
        email = f"contact{i+1}@{domain_name}.com"
        sql += f"INSERT INTO users (id, email, password, name, role, customer_id) VALUES ('{u_id}', '{email}', 'password', '{name.replace(chr(39), '')} Rep', 'customer', '{c_id}');\n"

    return sql


with open("d:\\OdooFinals\\DealFlow360\\database\\new_seeds.sql", "w", encoding="utf-8") as f:
    f.write(generate_sql())
    
print("SQL script generated.")
