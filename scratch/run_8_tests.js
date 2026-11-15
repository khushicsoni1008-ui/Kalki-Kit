const { executeUniversalVerification } = require('../server.js');

const testCases = [
    {
        id: 1,
        claim: "The Earth revolves around the Sun.",
        expected: ["TRUE"]
    },
    {
        id: 2,
        claim: "The Sun revolves around the Earth.",
        expected: ["FALSE"]
    },
    {
        id: 3,
        claim: "Water boils at 100°C at standard atmospheric pressure.",
        expected: ["TRUE"]
    },
    {
        id: 4,
        claim: "Narendra Modi is the Prime Minister of India.",
        expected: ["TRUE"]
    },
    {
        id: 5,
        claim: "Narendra Modi is the President of India.",
        expected: ["FALSE"]
    },
    {
        id: 6,
        claim: "Modern humans lived at the same time as non-avian dinosaurs.",
        expected: ["FALSE"]
    },
    {
        id: 7,
        claim: "Narendra Modi is the Prime Minister of India and was born in Paris.",
        expected: ["PARTIALLY TRUE"]
    },
    {
        id: 8,
        claim: "Narendra Modi is present.",
        expected: ["AMBIGUOUS", "UNVERIFIED"]
    }
];

async function runTests() {
    console.log("=================================================================");
    const modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
    console.log("RUNNING 8 MANDATORY VERIFICATION TESTS ON KALKI-KIT ENGINE");
    console.log(`Primary Gemini model: ${modelName}`);
    console.log("=================================================================\n");

    let allPassed = true;

    for (const test of testCases) {
        console.log(`>>> EXECUTING TEST ${test.id}: "${test.claim}"`);
        const result = await executeUniversalVerification(test.claim, process.env.GEMINI_API_KEY || '', modelName);
        
        const passed = test.expected.includes(result.verdict);
        if (passed) {
            console.log(`[PASS] Test ${test.id}: Expected ${test.expected.join(' or ')} -> Received ${result.verdict}`);
        } else {
            console.error(`[FAIL] Test ${test.id}: Expected ${test.expected.join(' or ')} -> Received ${result.verdict}`);
            allPassed = false;
        }
        console.log(`       Confidence: ${result.confidencePercent}% | Sources: ${result.sources.length}`);
        console.log(`       Why: ${result.why.slice(0, 140)}...\n`);
    }

    console.log("=================================================================");
    if (allPassed) {
        console.log("🎉 ALL 8 TESTS PASSED WITH 100% ACCURACY!");
    } else {
        console.log("❌ SOME TESTS FAILED. INVESTIGATE ENGINE.");
    }
    console.log("=================================================================");
    process.exit(allPassed ? 0 : 1);
}

runTests().catch(err => {
    console.error("Test execution encountered fatal error:", err);
    process.exit(1);
});
