export interface PriorLearningConfig {
  categoryKey: string
  categoryName: { en: string; te: string }
  books: Array<{ en: string; te: string }>
}

export const RAMANUJA_GRANTHA_CONFIG: PriorLearningConfig = {
  categoryKey: 'ramanuja-grantha',
  categoryName: {
    en: 'Ramanuja Grantha',
    te: 'రామానుజ గ్రంథం',
  },
  books: [
    { en: 'Gadya Triyam',        te: 'గద్య త్రయం' },
    { en: 'Gita Bhashyam',       te: 'గీత భాష్యం' },
    { en: 'Nitya Grantham',      te: 'నిత్య గ్రంథం' },
    { en: 'Sri Bhashyam',        te: 'శ్రీ భాష్యం' },
    { en: 'Vedanta Deepam',      te: 'వేదాంత దీపం' },
    { en: 'Vedanta Saram',       te: 'వేదాంత సారం' },
    { en: 'Vedartha Sangraham',  te: 'వేదార్థ సంగ్రహం' },
    { en: 'Yatindra Matadeepika', te: 'యతీంద్ర మతదీపిక' },
  ],
}
