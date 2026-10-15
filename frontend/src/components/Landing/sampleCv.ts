// An invented person for the start-page picture. Never put real CV data here.
import type { CvDraft } from '../../types/cvDraft';

export const sampleCv: CvDraft = {
  personal: { name: 'Meera Raghavan', headline: 'Senior Product Manager · Payments & Fintech', email: 'meera.r@example.com', phone: '+91 98765 43210', location: 'Bengaluru, IN', linkedin: 'linkedin.com/in/meera-example', portfolio: '' },
  summary: 'Product manager with 9 years in payments and lending products. Led cross-functional teams of up to 25 people and launched products used by 4 million customers.',
  experience: [
    { id: 'w1', title: 'Senior Product Manager', company: 'Example Payments Ltd, Bengaluru', start: '2021-04', end: '', current: 'true', yearOnly: '', description: '• Led the launch of instant refunds, cutting refund time from 5 days to 30 minutes\n• Owned the merchant dashboard roadmap across 3 engineering teams\n• Introduced quarterly customer research, adopted by 4 product teams' },
    { id: 'w2', title: 'Product Manager', company: 'Sample Lending Co., Mumbai', start: '2017-06', end: '2021-03', current: '', yearOnly: '', description: '• Built the digital loan application flow from scratch; approvals rose by 18%\n• Worked with risk and compliance to launch in 2 new states' },
    { id: 'w3', title: 'Business Analyst', company: 'Demo Consulting', start: '2015', end: '2017', current: '', yearOnly: 'true', description: 'Process analysis and reporting for banking clients.' },
  ],
  projects: [{ id: 'p1', name: 'Open-source budgeting app', url: 'github.com/meera-example/budget', start: '2022', end: '', yearOnly: 'true', description: 'A personal finance tracker with 2,000 monthly users.' }],
  education: [
    { id: 'e1', degree: 'MBA, Marketing & Finance', school: 'Example Institute of Management', start: '2013', end: '2015', score: 'CGPA 3.6/4', yearOnly: 'true' },
    { id: 'e2', degree: 'B.Tech, Computer Science', school: 'Sample Engineering College', start: '2009', end: '2013', score: 'First Class', yearOnly: 'true' },
  ],
  skills: ['Product strategy', 'Roadmapping', 'SQL', 'A/B testing', 'Stakeholder management', 'Payments compliance'],
  certifications: [{ id: 'c1', name: 'Certified Scrum Product Owner', issuer: 'Scrum Alliance', date: '2019-08', yearOnly: '' }],
  others: [
    { id: 'o1', kind: 'language', section: '', title: 'English', detail: 'Professional', start: '', end: '', description: '', yearOnly: '' },
    { id: 'o2', kind: 'language', section: '', title: 'Tamil', detail: 'Native', start: '', end: '', description: '', yearOnly: '' },
    { id: 'o3', kind: 'award', section: '', title: 'Product Excellence Award', detail: 'Example Payments Ltd', start: '2023-03', end: '', description: '', yearOnly: '' },
    { id: 'o4', kind: 'volunteer', section: '', title: 'Mentor', detail: 'Women in Product, Bengaluru chapter', start: '2020', end: '', description: 'Mentoring early-career product managers.', yearOnly: 'true' },
    { id: 'o5', kind: 'interest', section: '', title: 'Carnatic music', detail: '', start: '', end: '', description: '', yearOnly: '' },
    { id: 'o6', kind: 'interest', section: '', title: 'Trekking', detail: '', start: '', end: '', description: '', yearOnly: '' },
  ],
};
