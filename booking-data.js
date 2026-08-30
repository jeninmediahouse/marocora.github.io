const marocoraBookingState = {
    student: {
        id: "sample-student",

        account: {
            status: "active",
            country: "Morocco",
            preferredDisplayCurrency: "MAD"
        }
    },

    complimentaryIntroduction: {
        firstIntroduction: {
            status: "available",
            teacherId: null,
            bookingId: null,
            completedAt: null
        },

        firstTeacherDecision: {
            status: "pending",
            decision: null
            // Possible values later:
            // "continue"
            // "not-a-fit"
        },

        secondChance: {
            eligible: false,
            status: "locked",
            teacherId: null,
            bookingId: null,
            completedAt: null
        },

        complimentaryBenefitExhausted: false
    },

    bookingRules: {
        firstIntroductionMinutes: 30,
        secondChanceMinutes: 30,

        secondChanceRequiresDifferentTeacher: true,

        thirdComplimentaryIntroductionAllowed: false,

        paidBookingRequiredAfterSecondChance: true
    }
};
