const marocoraTeachers = [
    {
        id: "sample-darija",

        profile: {
            displayName: "Sample Darija Teacher",
            photo: "",
            headline: "Darija, Arabic & English Teacher",
            country: "Morocco",
            timezone: "Africa/Casablanca",
            nativeLanguage: "Moroccan Darija"
        },

        verification: {
            identityVerified: true,
            credentialsVerified: true,
            marocoraInterviewed: true
        },

        teaching: {
            deliveryMethod: "online",

            subjects: [
                {
                    name: "Moroccan Darija",
                    category: "Languages",
                    levels: [
                        "Complete Beginner",
                        "Beginner",
                        "Intermediate"
                    ]
                },
                {
                    name: "Arabic",
                    category: "Languages",
                    levels: [
                        "Beginner",
                        "Intermediate"
                    ]
                }
            ],

            languagesSpoken: [
                "Moroccan Darija",
                "Arabic",
                "English"
            ],

            studentTypes: [
                "Adults",
                "Teenagers"
            ],

            learningGoals: [
                "Everyday Conversation",
                "Moving to Morocco",
                "Travel",
                "Expat Life",
                "Speaking Confidence"
            ],

            specialties: [
                "Conversational Darija",
                "Beginner Darija",
                "Expat Support",
                "Practical Moroccan Communication"
            ],

            yearsTeachingExperience: 5,
            yearsOnlineTeachingExperience: 3
        },

        about: {
            shortBio:
                "Friendly online language teacher helping students build practical speaking skills and confidence.",

            fullBio:
                "I help students learn practical Moroccan Darija and Arabic for everyday communication. Lessons are adapted to each student's level, goals and learning pace, with a strong focus on useful conversation and real-life situations.",

            introductionVideo: ""
        },

        offerings: [
            {
                id: "discovery-30",
                title: "Meet Your Teacher — Free",
                type: "complimentary-introduction",
                durationMinutes: 30,

                pricing: {
                    baseAmount: 0,
                    baseCurrency: "MAD"
                },

                active: true
            },

            {
                id: "darija-30",
                title: "30-Minute Private Darija Lesson",
                type: "single-lesson",
                durationMinutes: 30,

                pricing: {
                    baseAmount: 100,
                    baseCurrency: "MAD"
                },

                active: true
            },

            {
                id: "darija-60",
                title: "60-Minute Private Darija Lesson",
                type: "single-lesson",
                durationMinutes: 60,

                pricing: {
                    baseAmount: 180,
                    baseCurrency: "MAD"
                },

                active: true
            },

            {
                id: "darija-90",
                title: "90-Minute Private Darija Lesson",
                type: "single-lesson",
                durationMinutes: 90,

                pricing: {
                    baseAmount: 250,
                    baseCurrency: "MAD"
                },

                active: true
            },

            {
                id: "darija-package-5",
                title: "5-Lesson Darija Package",
                type: "package",
                lessonCount: 5,
                durationMinutesPerLesson: 60,

                pricing: {
                    baseAmount: 850,
                    baseCurrency: "MAD"
                },

                active: true
            }
        ],

        capacity: {
            acceptingNewStudents: true,
            availableStudentSpaces: 5
        },

        availability: {
            timezone: "Africa/Casablanca",

            weeklySchedule: [
                {
                    day: "Monday",
                    times: ["10:00 AM"]
                },
                {
                    day: "Tuesday",
                    times: ["2:00 PM"]
                },
                {
                    day: "Wednesday",
                    times: ["6:00 PM"]
                },
                {
                    day: "Saturday",
                    times: ["11:00 AM"]
                }
            ]
        },

        reputation: {
            averageRating: 0,
            reviewCount: 0,
            completedLessons: 0,
            repeatStudents: 0,
            averageResponseMinutes: null
        },

        marketplace: {
            profileStatus: "active",
            searchable: true,
            acceptingBookings: true,
            newProvider: true,

            // Reserved for the future
            // "Help me choose" managed-matching system.
            matchingEligible: true
        }
    }
];
