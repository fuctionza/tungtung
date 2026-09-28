/**
 * HumTung English Grammar Engine
 * Specializing in "There is" vs. "There are", singular/plural, countable vs. uncountable nouns.
 */

class GrammarEngine {
    constructor() {
        // Pool of high quality, engaging classroom grammar questions
        this.questionBank = [
            {
                id: 'gq1',
                context: 'Shopping Aisle: Vegetable Stand',
                sentence: 'Look at the green basket. ______ three fresh tomatoes.',
                options: ['There is', 'There are', 'There be', 'Are there'],
                answer: 'There are',
                explanation: '"Three tomatoes" is a plural countable noun, so we use "There are".'
            },
            {
                id: 'gq2',
                context: 'Pantry Shelf: Grains & Staples',
                sentence: 'In the wooden jar, ______ some jasmine rice.',
                options: ['There is', 'There are', 'There have', 'Is there'],
                answer: 'There is',
                explanation: '"Rice" is an uncountable noun, so we always use "There is".'
            },
            {
                id: 'gq3',
                context: 'Kitchen Table: Seasonings',
                sentence: 'Next to the stove, ______ a bottle of premium soy sauce.',
                options: ['There is', 'There are', 'There were', 'There has'],
                answer: 'There is',
                explanation: '"A bottle" is singular, so we use "There is".'
            },
            {
                id: 'gq4',
                context: 'Cooler Box: Dairy & Eggs',
                sentence: 'In the egg carton, ______ six organic eggs.',
                options: ['There are', 'There is', 'There being', 'There has'],
                answer: 'There are',
                explanation: '"Six eggs" is plural, so we use "There are".'
            },
            {
                id: 'gq5',
                context: 'Butcher Counter: Meats',
                sentence: 'On the scale, ______ some fresh minced pork.',
                options: ['There is', 'There are', 'There have', 'Are there'],
                answer: 'There is',
                explanation: '"Pork" / meat is an uncountable noun here, so we use "There is".'
            },
            {
                id: 'gq6',
                context: 'Prep Station: Herbs',
                sentence: 'On the cutting board, ______ five sprigs of fragrant basil.',
                options: ['There are', 'There is', 'Is there', 'There has'],
                answer: 'There are',
                explanation: '"Five sprigs" is plural, so we use "There are".'
            },
            {
                id: 'gq7',
                context: 'Cashier Basket: Quick Scan',
                sentence: '______ an onion and two garlic cloves in your shopping cart.',
                options: ['There is', 'There are', 'There has', 'There were'],
                answer: 'There is',
                explanation: 'When the first item in a compound list is singular ("an onion"), English grammar commonly uses "There is" (proximity rule).'
            },
            {
                id: 'gq8',
                context: 'Soup Pot Station',
                sentence: 'In the simmering pot, ______ hot coconut milk broth.',
                options: ['There is', 'There are', 'There be', 'Are there'],
                answer: 'There is',
                explanation: '"Coconut milk" is a liquid/uncountable noun, requiring "There is".'
            }
        ];
    }

    /**
     * Generate dynamic quiz questions tailored to the player's cart items
     */
    generateQuizQuestions(cartItems, count = 3) {
        const dynamicQuestions = [];

        // Try generating questions based on actual cart items
        if (Array.isArray(cartItems) && cartItems.length > 0) {
            cartItems.forEach(item => {
                if (item.isUncountable) {
                    dynamicQuestions.push({
                        id: 'cart_' + item.id,
                        context: `Your Cart: ${item.name}`,
                        sentence: `In your shopping basket, ______ some ${item.name.toLowerCase()}.`,
                        options: ['There is', 'There are', 'There have', 'Is there'],
                        answer: 'There is',
                        explanation: `"${item.name}" is an uncountable food item, so we use "There is".`
                    });
                } else if (item.qty && item.qty > 1) {
                    dynamicQuestions.push({
                        id: 'cart_' + item.id,
                        context: `Your Cart: ${item.name} (${item.qty})`,
                        sentence: `On the checkout conveyor, ______ ${item.qty} ${item.pluralName || item.name + 's'}.`,
                        options: ['There are', 'There is', 'There was', 'There has'],
                        answer: 'There are',
                        explanation: `"${item.qty} ${item.pluralName || item.name + 's'}" is plural, so we use "There are".`
                    });
                } else {
                    dynamicQuestions.push({
                        id: 'cart_' + item.id,
                        context: `Your Cart: ${item.name}`,
                        sentence: `Ready for checkout, ______ ${item.article || 'a'} ${item.name.toLowerCase()}.`,
                        options: ['There is', 'There are', 'There were', 'Are there'],
                        answer: 'There is',
                        explanation: `"${item.article || 'a'} ${item.name}" is singular, so we use "There is".`
                    });
                }
            });
        }

        // Combine with pre-defined question bank and shuffle
        const pool = [...dynamicQuestions, ...this.questionBank];
        const shuffled = pool.sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }

    /**
     * Live NLP/Regex analyzer for player's dish description
     */
    analyzeDescription(text) {
        if (!text || typeof text !== 'string') {
            return {
                valid: false,
                score: 0,
                hints: ['Please write a description of your dish using "There is" and "There are".'],
                foundPhrases: []
            };
        }

        const trimmed = text.trim();
        const hints = [];
        const foundPhrases = [];
        let score = 0;

        // Check for "There is"
        const thereIsMatches = trimmed.match(/\bthere\s+is\s+([^,.;!?]+)/gi);
        if (thereIsMatches) {
            thereIsMatches.forEach(match => {
                foundPhrases.push({ type: 'is', text: match });
                score += 8;
            });
        } else {
            hints.push('💡 Tip: Try using "There is..." to describe singular or uncountable ingredients (e.g. "There is some steamed rice...").');
        }

        // Check for "There are"
        const thereAreMatches = trimmed.match(/\bthere\s+are\s+([^,.;!?]+)/gi);
        if (thereAreMatches) {
            thereAreMatches.forEach(match => {
                foundPhrases.push({ type: 'are', text: match });
                score += 8;
            });
        } else {
            hints.push('💡 Tip: Try using "There are..." to describe plural items (e.g. "There are three slices of beef...").');
        }

        // Check plural count correctness
        // Flag error if student writes "There is three" or "There are a"
        if (/\bthere\s+is\s+(\d+|two|three|four|five|six|seven|eight|nine|ten|many|several)\b/i.test(trimmed)) {
            hints.push('⚠️ Check Grammar: Plural counts (e.g. two, three, four) should use "There are", not "There is".');
            score = Math.max(0, score - 5);
        }

        if (/\bthere\s+are\s+(a|an|one)\b/i.test(trimmed)) {
            hints.push('⚠️ Check Grammar: Singular items ("a", "an", "one") should use "There is", not "There are".');
            score = Math.max(0, score - 5);
        }

        const valid = foundPhrases.length > 0;
        const normalizedScore = Math.min(15, score);

        return {
            valid,
            score: normalizedScore,
            hints: hints.length > 0 ? hints : ['✨ Excellent grammar! Your use of "There is" and "There are" is spot-on.'],
            foundPhrases
        };
    }
}

window.grammarEngine = new GrammarEngine();
