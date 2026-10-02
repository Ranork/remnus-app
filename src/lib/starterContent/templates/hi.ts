import type { TemplateText } from '../types';

const text: TemplateText = {
  locale: 'hi',
  stock: {
    title: 'शीर्षक',
    status: 'स्थिति',
    id: 'ID',
    todo: 'करना है',
    inProgress: 'प्रगति में',
    done: 'पूरा हुआ',
  },
  views: { table: 'तालिका', board: 'बोर्ड', calendar: 'कैलेंडर' },

  meetingNotes: `## उपस्थित लोग

- Sarah Chen (प्रोडक्ट मैनेजर)
- Marcus Johnson (इंजीनियरिंग लीड)
- Aisha Patel (डिज़ाइनर)

## एजेंडा

1. स्प्रिंट समीक्षा और वेलोसिटी जाँच
2. अगली तिमाही के रोडमैप की प्राथमिकताएँ
3. डिज़ाइन सिस्टम के अपडेट

## नोट्स

कुल मिलाकर स्प्रिंट अच्छा रहा। वेलोसिटी अनुमान से थोड़ी ऊपर रही। नया लॉगिन फ़्लो लाइव है और उम्मीद के मुताबिक़ चल रहा है।

अगली तिमाही की प्राथमिकताएँ: ऑनबोर्डिंग में सुधार और मोबाइल रिस्पॉन्सिवनेस पर ध्यान। मार्केटिंग को नया डैशबोर्ड अगले महीने के अंत तक चाहिए।

डिज़ाइन सिस्टम: Aisha अगले हफ़्ते अपडेट की गई कंपोनेंट लाइब्रेरी साझा करेंगी।

## कार्य आइटम

- [ ] Marcus: शुक्रवार तक स्टेजिंग एनवायरनमेंट तैयार करना
- [ ] Aisha: अगले मंगलवार तक डिज़ाइन सिस्टम v2 का ड्राफ़्ट साझा करना
- [ ] Sarah: अगली तिमाही के रोडमैप का ड्राफ़्ट टीम की समीक्षा के लिए भेजना
`,

  projectBrief: `## अवलोकन

अगली पीढ़ी का एक एनालिटिक्स डैशबोर्ड, जो टीमों को मुख्य मेट्रिक्स रियल टाइम में ट्रैक करने में मदद करता है। लक्ष्य है मौजूदा स्प्रेडशीट-आधारित रिपोर्टिंग की जगह एक केंद्रीकृत, स्वचालित समाधान लाना।

## लक्ष्य

- मैन्युअल रिपोर्टिंग का समय 80% घटाना
- टीम के KPI को रियल टाइम में दिखाना
- PDF और CSV में डेटा एक्सपोर्ट का समर्थन करना

## समयरेखा

| पड़ाव | तारीख़ |
|-------|--------|
| शुरुआत | {{kickoff}} |
| डिज़ाइन पूरा | {{designDone}} |
| बीटा रिलीज़ | {{beta}} |
| लॉन्च | {{launch}} |

## टीम

- प्रोडक्ट: Sarah Chen
- इंजीनियरिंग: Marcus Johnson, Kai Rivera
- डिज़ाइन: Aisha Patel
`,

  taskTracker: {
    columns: { priority: 'प्राथमिकता', assignee: 'ज़िम्मेदार', dueDate: 'नियत तारीख़' },
    status: { backlog: 'बैकलॉग', inProgress: 'प्रगति में', review: 'समीक्षा में', done: 'पूरा हुआ' },
    priority: { low: 'कम', medium: 'मध्यम', high: 'ऊँची' },
    rows: {
      landing: 'लैंडिंग पेज के मॉकअप डिज़ाइन करें',
      ci: 'CI/CD पाइपलाइन सेट करें',
      tests: 'ऑथ मॉड्यूल के लिए यूनिट टेस्ट लिखें',
      review: 'feature/payments ब्रांच का कोड रिव्यू',
      docs: 'API दस्तावेज़ अपडेट करें',
      staging: 'स्टेजिंग एनवायरनमेंट पर डिप्लॉय करें',
      loginBug: 'लॉगिन रीडायरेक्ट बग ठीक करें',
    },
  },

  eventCalendar: {
    columns: { eventDate: 'इवेंट की तारीख़', category: 'श्रेणी', notes: 'नोट्स' },
    category: { meeting: 'मीटिंग', conference: 'कॉन्फ़्रेंस', deadline: 'डेडलाइन', personal: 'निजी' },
    rows: {
      standup: { title: 'साप्ताहिक टीम स्टैंडअप', notes: 'हर सोमवार दोहराया जाता है' },
      planning: { title: 'स्प्रिंट प्लानिंग', notes: 'स्प्रिंट 14 की शुरुआत' },
      productReview: { title: 'तिमाही प्रोडक्ट समीक्षा', notes: 'हितधारकों के साथ रोडमैप की समीक्षा' },
      mvp: { title: 'प्रोजेक्ट MVP की डेडलाइन', notes: 'सभी फ़ीचर main में मर्ज होने चाहिए' },
      summit: { title: 'Frontend Summit', notes: 'ऑनलाइन — frontendsummit.io पर रजिस्टर करें' },
      handoff: { title: 'डिज़ाइन सिस्टम हैंडऑफ़', notes: 'Aisha v2 कंपोनेंट सौंपेंगी' },
      offsite: { title: 'टीम ऑफ़साइट', notes: 'इस्तांबुल — 2 रातें' },
    },
  },

  readingList: {
    columns: { rating: 'रेटिंग', genre: 'विधा', author: 'लेखक' },
    status: { wantToRead: 'पढ़नी है', reading: 'पढ़ रहे हैं', done: 'पढ़ ली' },
    genre: { fiction: 'कथा', nonFiction: 'कथेतर', tech: 'टेक', science: 'विज्ञान' },
    books: {
      pragmatic: 'The Pragmatic Programmer',
      dune: 'Dune',
      sapiens: 'सेपियन्स: मानव जाति का संक्षिप्त इतिहास',
      cleanCode: 'Clean Code',
      threeBody: 'The Three-Body Problem',
      briefHistory: 'समय का संक्षिप्त इतिहास',
      thinking: 'Thinking, Fast and Slow',
    },
  },

  agentMemory: {
    columns: { type: 'प्रकार', tags: 'टैग', date: 'तारीख़' },
    type: { decision: 'निर्णय', preference: 'पसंद', gotcha: 'सावधानी', fact: 'तथ्य' },
    tags: { architecture: 'आर्किटेक्चर', conventions: 'नियम', api: 'api', database: 'डेटाबेस', infra: 'इन्फ़्रा' },
    byType: 'प्रकार के अनुसार',
    rows: {
      postgres: 'मुख्य डेटास्टोर के लिए PostgreSQL इस्तेमाल करें',
      functional: 'React में क्लास कंपोनेंट की जगह फ़ंक्शनल कंपोनेंट को प्राथमिकता दें',
      rateLimit: 'स्टेजिंग API 100 अनुरोध/मिनट पर सीमित है — राइट्स को बैच में भेजें',
      tokens: 'डिज़ाइन टोकन Tailwind कॉन्फ़िग में नहीं, tokens.css में रहते हैं',
    },
  },
};

export default text;
