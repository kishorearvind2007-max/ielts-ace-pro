import { ListeningSection, ReadingPassage, WritingTask, SpeakingPart } from '@/lib/ielts-types';

export const listeningContent: ListeningSection[] = [
  {
    id: 1,
    title: 'Section 1: Accommodation Inquiry',
    script: `Good morning. Welcome to City Housing Services. How can I help you today?
Hi, I'm looking for a flat to rent. I've just started working at the hospital nearby.
Certainly. Let me take down some details. What's your full name?
It's Sarah Mitchell. That's M-I-T-C-H-E-L-L.
Thank you, Sarah. And your contact number?
It's 07845 629 310.
And what's your budget range for monthly rent?
I'd like to keep it under 850 pounds if possible. Ideally around 750.
OK. And how many bedrooms do you need?
Just one bedroom is fine. But I do need a parking space because I drive to work.
We have a lovely flat on Park Avenue. It's a one-bedroom with parking included. The rent is 795 pounds per month. Utilities are extra, about 120 per month.
That sounds good. When is it available from?
It's available from the first of September. The lease is for 12 months minimum.
Does it have a washing machine?
Yes, it comes fully furnished with a washing machine, fridge, and cooker. There's also a small balcony.`,
    questions: [
      { id: 1, type: 'short-answer', text: "What is the caller's surname?" },
      { id: 2, type: 'short-answer', text: "What is Sarah's phone number?" },
      { id: 3, type: 'short-answer', text: 'What is the maximum rent Sarah wants to pay per month (in pounds)?' },
      { id: 4, type: 'short-answer', text: 'How many bedrooms does Sarah need?' },
      { id: 5, type: 'short-answer', text: 'What street is the flat located on?' },
      { id: 6, type: 'short-answer', text: 'How much is the monthly rent for the flat (in pounds)?' },
      { id: 7, type: 'short-answer', text: 'How much are the monthly utilities approximately (in pounds)?' },
      { id: 8, type: 'short-answer', text: 'When is the flat available from?' },
      { id: 9, type: 'short-answer', text: 'What is the minimum lease period (in months)?' },
      { id: 10, type: 'mcq', text: 'Which of the following is NOT mentioned as included in the flat?', options: ['Washing machine', 'Dishwasher', 'Fridge', 'Cooker'] },
    ],
    answerKey: {
      1: 'Mitchell', 2: '07845 629 310|07845629310', 3: '850', 4: '1|one', 5: 'Park Avenue',
      6: '795', 7: '120', 8: '1st of September|first of September|1 September|September 1',
      9: '12', 10: 'Dishwasher',
    },
  },
  {
    id: 2,
    title: 'Section 2: Library Tour',
    script: `Welcome to Greenfield Public Library. I'm going to give you a brief tour of our facilities. The library has three floors. On the ground floor, as you come in through the main entrance, you'll find the reception desk straight ahead. To your left is the children's section with picture books and a play area. To the right is the periodicals section where we keep newspapers and magazines from the past six months.

If you go upstairs to the first floor, you'll find our main collection of fiction and non-fiction books. The reference section is at the back of this floor. We also have six computer workstations available for public use. You can book these for up to two hours at a time.

On the top floor, we have our study rooms. There are four individual study rooms and two group study rooms that can accommodate up to eight people. These can be booked online through our website. The top floor also houses our local history archive, which contains documents dating back to the 1800s.

Our opening hours are Monday to Friday, 9 AM to 7 PM, and Saturday 10 AM to 4 PM. We're closed on Sundays. Library membership is free for all residents.`,
    questions: [
      { id: 11, type: 'short-answer', text: 'How many floors does the library have?' },
      { id: 12, type: 'short-answer', text: 'What section is to the left of the main entrance?' },
      { id: 13, type: 'short-answer', text: 'How many months of newspapers and magazines are kept?' },
      { id: 14, type: 'short-answer', text: 'How many computer workstations are available?' },
      { id: 15, type: 'short-answer', text: 'What is the maximum booking time for a computer (in hours)?' },
      { id: 16, type: 'short-answer', text: 'How many individual study rooms are there?' },
      { id: 17, type: 'short-answer', text: 'How many people can the group study rooms accommodate?' },
      { id: 18, type: 'mcq', text: 'How can study rooms be booked?', options: ['By phone', 'Online through the website', 'At the reception desk', 'By email'] },
      { id: 19, type: 'short-answer', text: 'What time does the library close on Saturdays?' },
      { id: 20, type: 'true-false-ng', text: 'Library membership requires an annual fee.', options: ['True', 'False', 'Not Given'] },
    ],
    answerKey: {
      11: '3|three', 12: "children's section|children section", 13: '6|six',
      14: '6|six', 15: '2|two', 16: '4|four', 17: '8|eight',
      18: 'Online through the website', 19: '4 PM|4pm|16:00', 20: 'False',
    },
  },
  {
    id: 3,
    title: 'Section 3: Research Project Discussion',
    script: `Professor: So, let's discuss your group project on renewable energy adoption in urban areas. Maya, could you start by summarizing where you've got to?

Maya: Sure. We've completed our literature review and we've designed our survey. We're planning to distribute it to 500 households across three different neighborhoods.

Professor: That sounds like a solid sample size. Tom, what methodology are you using?

Tom: We're using a mixed-methods approach. The survey gives us quantitative data, and then we'll follow up with in-depth interviews with about 20 respondents who agree to participate further.

Professor: Good. And have you considered potential biases?

Lisa: Yes, we've identified that there might be a selection bias since people who are already interested in renewable energy are more likely to respond. We plan to address this by using stratified random sampling.

Professor: Excellent thinking, Lisa. What about your timeline?

Tom: We aim to complete data collection by the end of November. Analysis will take about three weeks, and we plan to submit the final report by January 15th.

Maya: One concern we have is about the interview transcription. It's quite time-consuming. We were wondering if we could use AI transcription tools.

Professor: That's fine, but make sure you verify the accuracy by checking at least a random sample of the transcripts manually. I'd suggest checking about 20 percent of them.`,
    questions: [
      { id: 21, type: 'mcq', text: 'What is the topic of the group project?', options: ['Climate change mitigation', 'Renewable energy adoption in urban areas', 'Solar panel efficiency', 'Electric vehicle usage'] },
      { id: 22, type: 'short-answer', text: 'How many households will receive the survey?' },
      { id: 23, type: 'short-answer', text: 'How many neighborhoods will be surveyed?' },
      { id: 24, type: 'mcq', text: 'What research methodology are they using?', options: ['Qualitative only', 'Quantitative only', 'Mixed methods', 'Experimental'] },
      { id: 25, type: 'short-answer', text: 'How many respondents will be interviewed in depth?' },
      { id: 26, type: 'short-answer', text: 'What type of sampling will address selection bias?' },
      { id: 27, type: 'short-answer', text: 'By when should data collection be completed?' },
      { id: 28, type: 'short-answer', text: 'How long will the analysis take (in weeks)?' },
      { id: 29, type: 'short-answer', text: 'What is the final report submission date?' },
      { id: 30, type: 'short-answer', text: 'What percentage of AI transcripts should be manually checked?' },
    ],
    answerKey: {
      21: 'Renewable energy adoption in urban areas', 22: '500', 23: '3|three',
      24: 'Mixed methods', 25: '20|twenty', 26: 'stratified random sampling',
      27: 'end of November|November', 28: '3|three', 29: 'January 15th|January 15|15 January',
      30: '20|20%|twenty',
    },
  },
  {
    id: 4,
    title: 'Section 4: Lecture on Ocean Acidification',
    script: `Today I want to talk about ocean acidification, which many scientists consider to be the equally evil twin of climate change. Since the beginning of the Industrial Revolution, the ocean has absorbed approximately 525 billion tonnes of carbon dioxide from the atmosphere. While this has helped slow global warming, it has come at a significant cost to marine ecosystems.

When carbon dioxide dissolves in seawater, it forms carbonic acid. This process has caused the average pH of surface ocean waters to decrease by 0.1 units since pre-industrial times. Now, this might sound small, but because the pH scale is logarithmic, this actually represents a 26 percent increase in acidity.

The organisms most affected are those that build shells or skeletons from calcium carbonate. These include corals, molluscs, and certain types of plankton called coccolithophores. As the water becomes more acidic, it becomes harder for these organisms to form and maintain their calcium carbonate structures. In some cases, the structures actually begin to dissolve.

Research conducted by Dr. Helena Frost at the Marine Biology Institute has shown that coral growth rates have declined by approximately 14 percent over the past two decades. Her team's experiments demonstrate that if current trends continue, coral reefs could lose up to 70 percent of their structural integrity by 2050.

The economic implications are also severe. Approximately 500 million people worldwide depend on coral reefs for food, coastal protection, and tourism income. The total economic value of coral reef services is estimated at 375 billion dollars annually.

Current mitigation strategies include reducing carbon emissions, establishing marine protected areas, and developing coral restoration programs. Some researchers are also exploring the possibility of alkalinity enhancement, which involves adding alkaline substances to seawater to counteract acidification.`,
    questions: [
      { id: 31, type: 'short-answer', text: 'How many billion tonnes of CO2 has the ocean absorbed since the Industrial Revolution?' },
      { id: 32, type: 'short-answer', text: 'By how many pH units has surface ocean water decreased?' },
      { id: 33, type: 'short-answer', text: 'What percentage increase in acidity does this represent?' },
      { id: 34, type: 'mcq', text: 'Which of the following is NOT mentioned as affected by ocean acidification?', options: ['Corals', 'Molluscs', 'Coccolithophores', 'Jellyfish'] },
      { id: 35, type: 'short-answer', text: 'Who led the research at the Marine Biology Institute?' },
      { id: 36, type: 'short-answer', text: 'By what percentage have coral growth rates declined?' },
      { id: 37, type: 'short-answer', text: 'What percentage of structural integrity could coral reefs lose by 2050?' },
      { id: 38, type: 'short-answer', text: 'How many million people depend on coral reefs?' },
      { id: 39, type: 'short-answer', text: 'What is the annual economic value of coral reef services (in billion dollars)?' },
      { id: 40, type: 'mcq', text: 'What does alkalinity enhancement involve?', options: ['Removing CO2 from water', 'Adding alkaline substances to seawater', 'Planting underwater vegetation', 'Filtering ocean water'] },
    ],
    answerKey: {
      31: '525', 32: '0.1', 33: '26', 34: 'Jellyfish',
      35: 'Dr. Helena Frost|Helena Frost', 36: '14', 37: '70',
      38: '500', 39: '375', 40: 'Adding alkaline substances to seawater',
    },
  },
];

export const readingContent: ReadingPassage[] = [
  {
    id: 1,
    title: 'The Rise of Urban Farming',
    text: `Urban farming, also known as urban agriculture, refers to the practice of cultivating, processing, and distributing food in or around urban areas. While the concept is not new — city dwellers have grown food in small plots for centuries — the modern urban farming movement has gained significant momentum in the past two decades, driven by concerns about food security, environmental sustainability, and the desire for fresh, locally produced food.

The scale of urban farming varies enormously. At one end of the spectrum, individuals tend small vegetable patches in their back gardens or on balconies. At the other, large commercial operations occupy entire rooftops of warehouses or purpose-built vertical farms that use hydroponics and artificial lighting to grow crops year-round. Between these extremes lie community gardens, allotment schemes, and small cooperative farms that serve local neighborhoods.

One of the most innovative developments in urban farming has been the rise of vertical farming. This technique involves growing crops in stacked layers, often in controlled indoor environments. The advantages are numerous: vertical farms can produce crops 350 times more efficiently per square meter than conventional farms, they use approximately 95 percent less water through recirculating hydroponic systems, and they eliminate the need for pesticides since the controlled environment prevents pest infestations.

However, vertical farming faces significant challenges. The initial capital investment is substantial, with a medium-sized vertical farm costing between 2 and 5 million dollars to establish. Energy costs for lighting and climate control are considerable — a typical vertical farm uses about 38.5 kilowatt-hours of energy per kilogram of produce, compared to just 5.4 kilowatt-hours for conventional greenhouse growing. Critics argue that until renewable energy becomes cheaper and more widely available, the carbon footprint of vertical farming may actually exceed that of traditional agriculture.

Community gardens represent a more accessible form of urban farming. Research by the American Community Gardening Association found that there are an estimated 18,000 community gardens in the United States alone. These spaces provide multiple benefits beyond food production. Studies have shown that participation in community gardening leads to increased physical activity, reduced stress levels, and stronger social connections among neighbors. A 2019 study published in The Lancet Planetary Health found that community gardeners consume 40 percent more fruits and vegetables than non-gardeners.

The economic benefits of urban farming are also noteworthy. A report by the United Nations Food and Agriculture Organization estimates that urban agriculture provides employment for approximately 800 million people worldwide. In developing countries, urban farming can account for up to 30 percent of household food consumption, significantly reducing food expenditure for low-income families.

Urban farming also offers environmental benefits. By producing food closer to consumers, it reduces the distance food travels from farm to plate — the so-called "food miles" that contribute to greenhouse gas emissions. The average meal in the United States travels approximately 2,400 kilometers before reaching the consumer's plate. Urban farms can reduce this to virtually zero.

Furthermore, urban farms can contribute to biodiversity. Green spaces in cities provide habitats for pollinators such as bees and butterflies, which have seen significant population declines in recent decades. Rooftop gardens and green walls also help to reduce the urban heat island effect, where cities are significantly warmer than surrounding rural areas due to the concentration of heat-absorbing buildings and pavement.

Despite these benefits, urban farming faces several obstacles. Land availability and cost in urban areas remain the primary barriers. Soil contamination from previous industrial use is a concern in many cities. Regulatory frameworks often lag behind the rapid growth of urban farming, creating uncertainty for practitioners. Water access and quality can also be problematic, particularly in older cities with aging infrastructure.

Looking ahead, the integration of technology into urban farming promises to address some of these challenges. Artificial intelligence is being used to optimize growing conditions, predict crop yields, and detect plant diseases early. The Internet of Things enables remote monitoring and management of urban farms. Advances in LED technology have reduced the energy requirements of indoor growing by approximately 40 percent over the past decade, and further improvements are expected.

The future of urban farming will likely involve a combination of high-tech commercial operations and grassroots community initiatives. Neither alone can solve the complex challenges of feeding growing urban populations sustainably, but together they represent a powerful complement to conventional agriculture.`,
    questions: [
      { id: 1, type: 'true-false-ng', text: 'Urban farming is an entirely new concept that emerged in the 21st century.', options: ['True', 'False', 'Not Given'] },
      { id: 2, type: 'true-false-ng', text: 'Vertical farms can produce crops 350 times more efficiently per square meter than conventional farms.', options: ['True', 'False', 'Not Given'] },
      { id: 3, type: 'true-false-ng', text: 'Vertical farming uses approximately 95% less water than traditional farming.', options: ['True', 'False', 'Not Given'] },
      { id: 4, type: 'true-false-ng', text: 'The majority of vertical farms in the US are owned by multinational corporations.', options: ['True', 'False', 'Not Given'] },
      { id: 5, type: 'short-answer', text: 'How much does a medium-sized vertical farm cost to establish (range in million dollars)?' },
      { id: 6, type: 'short-answer', text: 'How many community gardens exist in the United States?' },
      { id: 7, type: 'short-answer', text: 'What percentage more fruits and vegetables do community gardeners consume?' },
      { id: 8, type: 'short-answer', text: 'How many people worldwide does urban agriculture employ (in millions)?' },
      { id: 9, type: 'short-answer', text: 'How many kilometers does the average US meal travel?' },
      { id: 10, type: 'mcq', text: 'What is the primary barrier to urban farming mentioned in the passage?', options: ['Water quality', 'Soil contamination', 'Land availability and cost', 'Lack of technology'] },
      { id: 11, type: 'true-false-ng', text: 'LED technology has reduced energy requirements of indoor growing by about 40% over the past decade.', options: ['True', 'False', 'Not Given'] },
      { id: 12, type: 'short-answer', text: 'What percentage of household food consumption can urban farming account for in developing countries?' },
      { id: 13, type: 'mcq', text: 'According to the passage, what helps reduce the urban heat island effect?', options: ['Underground farms', 'Rooftop gardens and green walls', 'Water recycling systems', 'Solar panels'] },
    ],
    answerKey: {
      1: 'False', 2: 'True', 3: 'True', 4: 'Not Given',
      5: '2 to 5|2-5|2 and 5', 6: '18000|18,000', 7: '40', 8: '800',
      9: '2400|2,400', 10: 'Land availability and cost', 11: 'True',
      12: '30', 13: 'Rooftop gardens and green walls',
    },
  },
  {
    id: 2,
    title: 'The Psychology of Decision Making',
    text: `The study of decision making has been transformed over the past fifty years by research demonstrating that human choices are far less rational than classical economic theory assumed. The work of psychologists Daniel Kahneman and Amos Tversky, which earned Kahneman the Nobel Prize in Economics in 2002, revealed systematic biases in human judgment that affect everything from everyday consumer choices to high-stakes medical and financial decisions.

At the heart of Kahneman and Tversky's framework is the distinction between two systems of thinking, which Kahneman later popularized in his bestselling book "Thinking, Fast and Slow." System 1 operates automatically and quickly, with little or no effort and no sense of voluntary control. It is responsible for intuitive judgments, snap decisions, and the recognition of patterns. System 2, by contrast, allocates attention to effortful mental activities, including complex computations, logical reasoning, and careful analysis. System 2 is often associated with the subjective experience of agency, choice, and concentration.

The critical insight is that System 1 is far more influential in our decision-making than most people realize. We like to believe that we are rational agents, carefully weighing costs and benefits before making choices. In reality, most of our decisions are guided by mental shortcuts — or "heuristics" — that System 1 employs to simplify complex problems. These heuristics are generally useful but can lead to systematic errors in judgment.

One of the most well-documented heuristics is the anchoring effect. When people are asked to estimate an uncertain quantity, their estimates are heavily influenced by whatever number they have most recently encountered, even if that number is entirely irrelevant. In one famous experiment, Kahneman and Tversky had participants spin a wheel of fortune that stopped at either 10 or 65. They then asked participants to estimate the percentage of African countries in the United Nations. Those who had seen the wheel stop at 65 gave estimates that were, on average, 20 percentage points higher than those who had seen it stop at 10.

The availability heuristic is another powerful bias. People tend to judge the likelihood of events based on how easily examples come to mind. This is why many people overestimate the risk of dramatic but rare events — such as plane crashes or shark attacks — while underestimating the risk of common but less dramatic causes of harm, such as heart disease or car accidents. Media coverage amplifies this effect: the more prominently an event is covered in the news, the more readily available it becomes in memory, and the higher we estimate its probability.

Loss aversion, another key concept from Kahneman and Tversky's prospect theory, describes the finding that losses loom larger than equivalent gains. Research consistently shows that the psychological pain of losing a sum of money is approximately twice as intense as the pleasure of gaining the same amount. This asymmetry has profound implications for behavior: it explains why investors hold onto losing stocks for too long (hoping to avoid realizing a loss), why people are reluctant to sell their homes for less than they paid, and why negotiators often fail to reach agreements that would benefit both parties.

The framing effect demonstrates that the way a choice is presented significantly influences decisions. When a medical treatment is described as having a "90 percent survival rate," people are far more likely to choose it than when the same treatment is described as having a "10 percent mortality rate." The objective information is identical, but the psychological impact is dramatically different. This finding has important implications for public health communication, marketing, and policy design.

More recent research has explored the role of emotions in decision making. Antonio Damasio's somatic marker hypothesis proposes that emotions play a crucial role in rational decision making. Studying patients with damage to the ventromedial prefrontal cortex — an area of the brain involved in processing emotions — Damasio found that these patients made disastrously poor decisions in their personal lives and in gambling tasks, despite having intact intellectual abilities. This suggests that emotions are not the enemy of rationality but an essential component of good judgment.

The implications of decision-making research extend far beyond the laboratory. In the field of behavioral economics, researchers and policymakers have developed "nudges" — subtle changes in the way choices are presented that can steer people toward better decisions without restricting their freedom of choice. Default options, for example, have a powerful effect on behavior. When retirement savings plans are opt-in, participation rates are typically around 50 percent. When the default is switched to opt-out, participation rates rise to approximately 90 percent, even though individuals can still choose not to participate.

Understanding decision-making biases also has critical applications in medicine. Studies have shown that physicians are susceptible to the same cognitive biases as everyone else. Diagnostic errors, which account for approximately 10 to 15 percent of all diagnoses, are often attributable to cognitive biases such as anchoring on an initial diagnosis and failing to consider alternatives, or being influenced by the order in which information is presented.

The growing awareness of cognitive biases has led to the development of debiasing strategies. These include structured decision-making frameworks, checklists, pre-mortem analysis (imagining that a decision has already failed and working backwards to identify what went wrong), and the deliberate seeking of disconfirming evidence. While no technique can eliminate bias entirely, these approaches can significantly reduce its impact on important decisions.`,
    questions: [
      { id: 14, type: 'mcq', text: 'When did Kahneman receive the Nobel Prize in Economics?', options: ['1998', '2000', '2002', '2004'] },
      { id: 15, type: 'true-false-ng', text: 'System 1 thinking requires significant conscious effort.', options: ['True', 'False', 'Not Given'] },
      { id: 16, type: 'true-false-ng', text: 'Heuristics always lead to incorrect decisions.', options: ['True', 'False', 'Not Given'] },
      { id: 17, type: 'short-answer', text: 'In the anchoring experiment, what was the difference in estimates (in percentage points)?' },
      { id: 18, type: 'mcq', text: 'According to the passage, the psychological pain of losing money is how many times more intense than the pleasure of gaining?', options: ['1.5 times', 'Twice', 'Three times', 'Four times'] },
      { id: 19, type: 'true-false-ng', text: 'Damasio found that patients with emotional processing damage made better financial decisions.', options: ['True', 'False', 'Not Given'] },
      { id: 20, type: 'short-answer', text: 'What is the participation rate for opt-out retirement savings plans (percentage)?' },
      { id: 21, type: 'short-answer', text: 'What percentage of all diagnoses are estimated to be diagnostic errors?' },
      { id: 22, type: 'mcq', text: 'Which of the following is mentioned as a debiasing strategy?', options: ['Meditation', 'Pre-mortem analysis', 'Speed reading', 'Group voting'] },
      { id: 23, type: 'true-false-ng', text: 'Kahneman and Tversky developed their framework together before the 1980s.', options: ['True', 'False', 'Not Given'] },
      { id: 24, type: 'short-answer', text: 'What is the name of Kahneman\'s bestselling book?' },
      { id: 25, type: 'mcq', text: 'What does the term "nudge" refer to in behavioral economics?', options: ['Financial incentives', 'Legal regulations', 'Subtle changes in how choices are presented', 'Punishment for poor decisions'] },
      { id: 26, type: 'true-false-ng', text: 'The framing effect only impacts uneducated individuals.', options: ['True', 'False', 'Not Given'] },
    ],
    answerKey: {
      14: '2002', 15: 'False', 16: 'False', 17: '20',
      18: 'Twice', 19: 'False', 20: '90', 21: '10 to 15|10-15',
      22: 'Pre-mortem analysis', 23: 'Not Given',
      24: 'Thinking, Fast and Slow|Thinking Fast and Slow', 25: 'Subtle changes in how choices are presented',
      26: 'Not Given',
    },
  },
  {
    id: 3,
    title: 'Artificial Intelligence: Promise and Peril',
    text: `The rapid advancement of artificial intelligence has prompted intense debate among scientists, ethicists, and policymakers about its potential to transform society for better or worse. While AI systems have already demonstrated remarkable capabilities — from diagnosing diseases and discovering new drugs to driving vehicles and translating languages — the technology raises profound questions about employment, privacy, accountability, and the very nature of human intelligence.

The current generation of AI systems, often referred to as "narrow" or "weak" AI, excels at specific, well-defined tasks. Deep learning models, which use artificial neural networks loosely inspired by the human brain, have achieved superhuman performance in several domains. In 2017, Google's AlphaGo defeated the world champion at Go, a game long considered too complex for computers due to its vast number of possible moves — estimated at more than 10 to the power of 170, far exceeding the number of atoms in the observable universe. More recently, large language models such as GPT-4 have demonstrated an ability to generate human-like text, write computer code, pass standardized exams, and engage in nuanced reasoning across multiple domains.

However, the distinction between narrow AI and artificial general intelligence (AGI) — a hypothetical system capable of performing any intellectual task that a human can — remains crucial. Despite impressive advances, no current AI system possesses genuine understanding, consciousness, or the ability to transfer knowledge flexibly across unrelated domains. As the cognitive scientist Gary Marcus has argued, today's AI systems are "interpolation engines" that excel at pattern matching within their training data but struggle with novel situations that require common sense reasoning or causal understanding.

The impact of AI on employment is perhaps the most immediate concern. A widely cited 2013 study by Carl Benedikt Frey and Michael Osborne of Oxford University estimated that 47 percent of US jobs were at high risk of automation within the next two decades. More recent analyses have moderated this figure somewhat, with a 2023 Goldman Sachs report suggesting that generative AI could automate approximately 25 percent of current work tasks across all occupations, potentially displacing 300 million full-time jobs globally. However, the report also projected that AI could increase annual global GDP by 7 percent over a ten-year period.

The employment effects of AI are unlikely to be evenly distributed. Research suggests that middle-skill, routine jobs — such as data entry, bookkeeping, and basic legal research — face the highest risk of automation. Conversely, jobs requiring creativity, complex social interaction, or physical dexterity in unpredictable environments are likely to prove more resistant. Some economists argue that AI will primarily augment rather than replace human workers, creating new roles that combine human judgment with AI capabilities. Historical precedent offers some support for this view: the introduction of ATMs, for example, did not eliminate bank teller jobs but shifted them toward more advisory and relationship-focused functions.

AI also raises significant ethical concerns regarding bias and fairness. Machine learning systems learn from historical data, and when that data reflects existing societal biases — as it invariably does — the resulting AI models can perpetuate and even amplify those biases. A landmark 2018 study by researchers at MIT and Stanford found that commercial facial recognition systems had error rates of up to 34.7 percent for dark-skinned women, compared to less than 1 percent for light-skinned men. This disparity has led to calls for greater regulation of AI systems used in high-stakes decisions such as hiring, lending, and criminal justice.

Privacy represents another critical challenge. AI systems typically require vast quantities of data to function effectively, creating strong incentives for organizations to collect and analyze personal information on an unprecedented scale. The combination of facial recognition, natural language processing, and predictive analytics enables a degree of surveillance that was previously impossible. China's social credit system, which uses AI to monitor and score citizens' behavior, has been widely criticized as a model of techno-authoritarian governance.

The question of accountability — who is responsible when an AI system causes harm — remains largely unresolved. When a self-driving car causes an accident, should liability fall on the manufacturer, the software developer, the owner, or the AI system itself? Current legal frameworks, designed for a world of human decision-makers, struggle to accommodate the distributed and opaque nature of AI decision-making. The European Union's proposed AI Act, which classifies AI applications by risk level and imposes requirements accordingly, represents one of the most comprehensive attempts to address this regulatory gap.

Perhaps the most speculative but potentially most consequential concern involves existential risk. Some prominent figures, including the late physicist Stephen Hawking and technology entrepreneur Elon Musk, have warned that the development of superintelligent AI — systems vastly exceeding human intelligence across all domains — could pose an existential threat to humanity. The argument, developed most rigorously by philosopher Nick Bostrom in his book "Superintelligence," is that a sufficiently advanced AI system pursuing goals that are even slightly misaligned with human values could cause catastrophic harm, potentially rendering humanity unable to correct the situation.

Others dismiss these concerns as premature or unfounded. The AI researcher Yann LeCun has argued that current AI systems are nowhere near general intelligence and that fears about superintelligence distract from more pressing issues such as bias, privacy, and job displacement. Andrew Ng, another leading AI researcher, has compared worrying about superintelligent AI to "worrying about overpopulation on Mars."

The path forward likely requires a combination of technical research, ethical reflection, and thoughtful regulation. Technical approaches to AI safety include developing methods for aligning AI systems' objectives with human values, creating interpretable models whose decision-making processes can be understood and scrutinized, and building robust AI systems that behave reliably even in novel situations. Ethical frameworks must grapple with questions of fairness, transparency, and the distribution of AI's benefits and risks across society. And regulatory approaches must balance the promotion of innovation with the protection of fundamental rights and democratic values.`,
    questions: [
      { id: 27, type: 'mcq', text: 'What type of AI is described as the "current generation"?', options: ['General AI', 'Strong AI', 'Narrow/weak AI', 'Superintelligent AI'] },
      { id: 28, type: 'short-answer', text: 'In what year did AlphaGo defeat the world champion at Go?' },
      { id: 29, type: 'short-answer', text: 'According to Frey and Osborne, what percentage of US jobs were at high risk of automation?' },
      { id: 30, type: 'short-answer', text: 'How many full-time jobs could generative AI potentially displace globally (in millions)?' },
      { id: 31, type: 'short-answer', text: 'By what percentage could AI increase annual global GDP over ten years?' },
      { id: 32, type: 'true-false-ng', text: 'The introduction of ATMs eliminated most bank teller jobs.', options: ['True', 'False', 'Not Given'] },
      { id: 33, type: 'short-answer', text: 'What was the error rate for facial recognition on dark-skinned women (percentage)?' },
      { id: 34, type: 'mcq', text: 'Which country\'s social credit system is criticized in the passage?', options: ['United States', 'Russia', 'China', 'Japan'] },
      { id: 35, type: 'true-false-ng', text: 'The European Union has already passed the AI Act into law.', options: ['True', 'False', 'Not Given'] },
      { id: 36, type: 'short-answer', text: 'Who wrote the book "Superintelligence"?' },
      { id: 37, type: 'mcq', text: 'Who compared worrying about superintelligent AI to overpopulation on Mars?', options: ['Elon Musk', 'Yann LeCun', 'Andrew Ng', 'Gary Marcus'] },
      { id: 38, type: 'true-false-ng', text: 'Gary Marcus considers current AI systems to be genuine thinking machines.', options: ['True', 'False', 'Not Given'] },
      { id: 39, type: 'true-false-ng', text: 'Jobs requiring creativity are more resistant to automation than routine data entry jobs.', options: ['True', 'False', 'Not Given'] },
      { id: 40, type: 'mcq', text: 'What does the passage suggest is needed for the path forward with AI?', options: ['Only technical research', 'Only regulation', 'A combination of technical research, ethical reflection, and regulation', 'Stopping AI development entirely'] },
    ],
    answerKey: {
      27: 'Narrow/weak AI', 28: '2017', 29: '47', 30: '300',
      31: '7', 32: 'False', 33: '34.7', 34: 'China',
      35: 'Not Given', 36: 'Nick Bostrom', 37: 'Andrew Ng',
      38: 'False', 39: 'True', 40: 'A combination of technical research, ethical reflection, and regulation',
    },
  },
];

export const writingContent: WritingTask[] = [
  {
    id: 1,
    type: 'task1',
    prompt: 'The line graph below shows the percentage of households with internet access in four different countries between 2005 and 2020. Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.',
    minWords: 150,
    recommendedMinutes: 20,
    chartType: 'line',
    chartData: {
      labels: ['2005', '2008', '2011', '2014', '2017', '2020'],
      datasets: [
        { label: 'South Korea', data: [73, 81, 92, 96, 98, 99] },
        { label: 'Germany', data: [62, 75, 83, 89, 93, 96] },
        { label: 'Brazil', data: [21, 34, 46, 57, 67, 81] },
        { label: 'Nigeria', data: [5, 11, 24, 38, 48, 62] },
      ],
    },
  },
  {
    id: 2,
    type: 'task2',
    prompt: 'Some people believe that universities should focus on providing academic skills and theoretical knowledge, while others argue that universities should prepare students for their future careers with practical skills. Discuss both views and give your own opinion. Write at least 250 words.',
    minWords: 250,
    recommendedMinutes: 40,
  },
];

export const speakingContent: SpeakingPart[] = [
  {
    part: 1,
    questions: [
      'Can you tell me your full name?',
      "Where are you from? What's it like living there?",
      'Do you work or are you a student?',
      'What do you enjoy doing in your free time?',
      "Let's talk about food. What's your favourite type of cuisine and why?",
      'How often do you cook at home?',
    ],
  },
  {
    part: 2,
    questions: ['Describe a skill that took you a long time to learn.'],
    cueCard: {
      topic: 'Describe a skill that took you a long time to learn',
      points: [
        'What the skill is',
        'When you started learning it',
        'How you learned it',
        'And explain why it took you a long time to learn',
      ],
      followUp: 'Have you fully mastered this skill now?',
    },
    prepTime: 60,
    speakTime: 120,
  },
  {
    part: 3,
    questions: [
      'What skills do you think are most important for young people to learn today?',
      'Do you think schools focus too much on academic skills and not enough on practical skills?',
      'How has technology changed the way people learn new skills?',
      'Is it better to learn a skill from a teacher or to teach yourself? Why?',
      'Do you think some people are naturally better at learning new skills than others?',
    ],
  },
];
