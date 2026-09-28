// Launch subjects. Availability depends on real staff-published instructors.
export const taxonomy = {
  "categories": [
    {
      "id": "languages",
      "name": {
        "en": "Languages",
        "fr": "Langues"
      },
      "active": true
    },
    {
      "id": "mathematics",
      "name": {
        "en": "Mathematics",
        "fr": "Mathématiques"
      },
      "active": true
    },
    {
      "id": "science",
      "name": {
        "en": "Science",
        "fr": "Sciences"
      },
      "active": true
    }
  ],
  "subjects": [
    {
      "id": "english",
      "categoryId": "languages",
      "slug": "english",
      "name": {
        "en": "English",
        "fr": "Anglais"
      },
      "aliases": [
        "anglais"
      ],
      "active": true
    },
    {
      "id": "arabic",
      "categoryId": "languages",
      "slug": "arabic",
      "name": {
        "en": "Arabic",
        "fr": "Arabe"
      },
      "aliases": [
        "arabe"
      ],
      "active": true
    },
    {
      "id": "darija",
      "categoryId": "languages",
      "slug": "darija",
      "name": {
        "en": "Moroccan Darija",
        "fr": "Darija marocaine"
      },
      "aliases": [
        "Darija",
        "Moroccan Arabic",
        "arabe marocain"
      ],
      "active": true
    },
    {
      "id": "french",
      "categoryId": "languages",
      "slug": "french",
      "name": {
        "en": "French",
        "fr": "Français"
      },
      "aliases": [
        "francais"
      ],
      "active": true
    },
    {
      "id": "spanish",
      "categoryId": "languages",
      "slug": "spanish",
      "name": {
        "en": "Spanish",
        "fr": "Espagnol"
      },
      "aliases": [
        "espagnol"
      ],
      "active": true
    },
    {
      "id": "arithmetic",
      "categoryId": "mathematics",
      "slug": "arithmetic",
      "name": {
        "en": "Arithmetic",
        "fr": "Arithmétique"
      },
      "aliases": [
        "arithmetique",
        "basic math"
      ],
      "active": true
    },
    {
      "id": "pre-algebra",
      "categoryId": "mathematics",
      "slug": "pre-algebra",
      "name": {
        "en": "Pre-algebra",
        "fr": "Pré-algèbre"
      },
      "aliases": [
        "prealgebra"
      ],
      "active": true
    },
    {
      "id": "algebra",
      "categoryId": "mathematics",
      "slug": "algebra",
      "name": {
        "en": "Algebra",
        "fr": "Algèbre"
      },
      "aliases": [
        "algebre"
      ],
      "active": true
    },
    {
      "id": "geometry",
      "categoryId": "mathematics",
      "slug": "geometry",
      "name": {
        "en": "Geometry",
        "fr": "Géométrie"
      },
      "aliases": [
        "geometrie",
        "geomatry"
      ],
      "active": true
    },
    {
      "id": "trigonometry",
      "categoryId": "mathematics",
      "slug": "trigonometry",
      "name": {
        "en": "Trigonometry",
        "fr": "Trigonométrie"
      },
      "aliases": [
        "trigonometrie"
      ],
      "active": true
    },
    {
      "id": "precalculus",
      "categoryId": "mathematics",
      "slug": "precalculus",
      "name": {
        "en": "Precalculus",
        "fr": "Pré-calcul"
      },
      "aliases": [
        "pre-calculus"
      ],
      "active": true
    },
    {
      "id": "calculus",
      "categoryId": "mathematics",
      "slug": "calculus",
      "name": {
        "en": "Calculus",
        "fr": "Calcul différentiel et intégral"
      },
      "aliases": [
        "calculus"
      ],
      "active": true
    },
    {
      "id": "statistics",
      "categoryId": "mathematics",
      "slug": "statistics",
      "name": {
        "en": "Statistics",
        "fr": "Statistiques"
      },
      "aliases": [
        "statistiques"
      ],
      "active": true
    },
    {
      "id": "probability",
      "categoryId": "mathematics",
      "slug": "probability",
      "name": {
        "en": "Probability",
        "fr": "Probabilités"
      },
      "aliases": [
        "probabilites"
      ],
      "active": true
    },
    {
      "id": "linear-algebra",
      "categoryId": "mathematics",
      "slug": "linear-algebra",
      "name": {
        "en": "Linear algebra",
        "fr": "Algèbre linéaire"
      },
      "aliases": [
        "linear algebra"
      ],
      "active": true
    },
    {
      "id": "discrete-mathematics",
      "categoryId": "mathematics",
      "slug": "discrete-mathematics",
      "name": {
        "en": "Discrete mathematics",
        "fr": "Mathématiques discrètes"
      },
      "aliases": [
        "discrete math"
      ],
      "active": true
    },
    {
      "id": "physics",
      "categoryId": "science",
      "slug": "physics",
      "name": {
        "en": "Physics",
        "fr": "Physique"
      },
      "aliases": [
        "physique"
      ],
      "active": true
    }
  ],
  "specialties": [
    {
      "id": "conversation",
      "subjectIds": [
        "english",
        "arabic",
        "darija",
        "french",
        "spanish"
      ],
      "name": {
        "en": "Conversation",
        "fr": "Conversation"
      }
    },
    {
      "id": "beginners",
      "subjectIds": [
        "english",
        "arabic",
        "darija",
        "french",
        "spanish"
      ],
      "name": {
        "en": "Beginners",
        "fr": "Débutants"
      }
    },
    {
      "id": "travel",
      "subjectIds": [
        "english",
        "arabic",
        "darija",
        "french",
        "spanish"
      ],
      "name": {
        "en": "Travel",
        "fr": "Voyage"
      }
    },
    {
      "id": "expats",
      "subjectIds": [
        "darija"
      ],
      "name": {
        "en": "For expats",
        "fr": "Pour les expatriés"
      }
    },
    {
      "id": "business",
      "subjectIds": [
        "english",
        "arabic",
        "french",
        "spanish"
      ],
      "name": {
        "en": "Business language",
        "fr": "Langue professionnelle"
      }
    },
    {
      "id": "mechanics",
      "subjectIds": [
        "physics"
      ],
      "name": {
        "en": "Mechanics",
        "fr": "Mécanique"
      }
    },
    {
      "id": "electricity",
      "subjectIds": [
        "physics"
      ],
      "name": {
        "en": "Electricity and magnetism",
        "fr": "Électricité et magnétisme"
      }
    },
    {
      "id": "waves",
      "subjectIds": [
        "physics"
      ],
      "name": {
        "en": "Waves and optics",
        "fr": "Ondes et optique"
      }
    },
    {
      "id": "thermodynamics",
      "subjectIds": [
        "physics"
      ],
      "name": {
        "en": "Thermodynamics",
        "fr": "Thermodynamique"
      }
    },
    {
      "id": "modern-physics",
      "subjectIds": [
        "physics"
      ],
      "name": {
        "en": "Modern physics",
        "fr": "Physique moderne"
      }
    }
  ]
};
const names={"ar": {"languages": "اللغات", "mathematics": "الرياضيات", "science": "العلوم", "english": "الإنجليزية", "arabic": "العربية", "darija": "الدارجة المغربية", "french": "الفرنسية", "spanish": "الإسبانية", "arithmetic": "الحساب", "pre-algebra": "تمهيد الجبر", "algebra": "الجبر", "geometry": "الهندسة", "trigonometry": "حساب المثلثات", "precalculus": "تمهيد التفاضل والتكامل", "calculus": "التفاضل والتكامل", "statistics": "الإحصاء", "probability": "الاحتمالات", "linear-algebra": "الجبر الخطي", "discrete-mathematics": "الرياضيات المتقطعة", "physics": "الفيزياء", "conversation": "المحادثة", "beginners": "المبتدئون", "travel": "السفر", "expats": "للمقيمين الأجانب", "business": "لغة الأعمال", "mechanics": "الميكانيكا", "electricity": "الكهرباء والمغناطيسية", "waves": "الموجات والبصريات", "thermodynamics": "الديناميكا الحرارية", "modern-physics": "الفيزياء الحديثة"}, "es": {"languages": "Idiomas", "mathematics": "Matemáticas", "science": "Ciencias", "english": "Inglés", "arabic": "Árabe", "darija": "Darija marroquí", "french": "Francés", "spanish": "Español", "arithmetic": "Aritmética", "pre-algebra": "Preálgebra", "algebra": "Álgebra", "geometry": "Geometría", "trigonometry": "Trigonometría", "precalculus": "Precálculo", "calculus": "Cálculo", "statistics": "Estadística", "probability": "Probabilidad", "linear-algebra": "Álgebra lineal", "discrete-mathematics": "Matemáticas discretas", "physics": "Física", "conversation": "Conversación", "beginners": "Principiantes", "travel": "Viajes", "expats": "Para expatriados", "business": "Idioma para negocios", "mechanics": "Mecánica", "electricity": "Electricidad y magnetismo", "waves": "Ondas y óptica", "thermodynamics": "Termodinámica", "modern-physics": "Física moderna"}};
for(const item of [...taxonomy.categories,...taxonomy.subjects,...taxonomy.specialties])for(const locale of ["ar","es"])item.name[locale]=names[locale][item.id];
export const launchSubjects = taxonomy.subjects;
export function canonicalSubject(category, subject) {
 return launchSubjects.find(s => [s.id,...Object.values(s.name),...s.aliases].some(n => n.toLocaleLowerCase() === String(subject).trim().toLocaleLowerCase()) && [s.categoryId, ...Object.values(taxonomy.categories.find(c => c.id===s.categoryId).name)].some(n => n.toLocaleLowerCase()===String(category).trim().toLocaleLowerCase()));
}
