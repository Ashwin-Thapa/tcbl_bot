/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI, Content, Part, GenerateContentResponse, Type } from "@google/genai";

// DOM Elements
const chatForm = document.getElementById('chat-form') as HTMLFormElement;
const userInput = document.getElementById('user-input') as HTMLInputElement;
const chatMessages = document.getElementById('chat-messages') as HTMLElement;
const typingIndicator = document.getElementById('typing-indicator') as HTMLElement;
const typingIndicatorText = typingIndicator ? typingIndicator.querySelector('p') as HTMLParagraphElement : null;
const quickOrderBtn = document.getElementById('quick-order-btn') as HTMLButtonElement;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const uploadButton = document.getElementById('upload-button') as HTMLButtonElement;
const filePreviewArea = document.getElementById('file-preview-area') as HTMLElement;
const fileNameDisplay = document.getElementById('file-name-display') as HTMLElement;
const clearFileButton = document.getElementById('clear-file-button') as HTMLButtonElement;
const chatbotHeader = document.getElementById('chatbot-header') as HTMLElement;
const chatWidgetContainer = document.getElementById('chat-widget-container') as HTMLElement;
const closeChatWidgetBtn = document.getElementById('close-chat-widget-btn') as HTMLButtonElement;
const openChatWidgetBtn = document.getElementById('open-chat-widget-btn') as HTMLButtonElement;
const quickReplyContainer = document.getElementById('quick-reply-buttons') as HTMLElement;
const chatSubmitButton = chatForm ? chatForm.querySelector('button[type="submit"]') as HTMLButtonElement : null;

// Order Celebration Animation Elements
const orderCelebrationAnimationEl = document.getElementById('order-celebration-animation') as HTMLElement;
const celebrationCakeContainerEl = document.getElementById('celebration-cake-container') as HTMLElement;
const celebrationThankYouEl = document.getElementById('celebration-thank-you') as HTMLElement;

let selectedFile: File | null = null;
let imageUploadedThisTurn = false; // Flag to indicate if an image was part of the current user message

// For Image Enhancement
let uploadedImageBase64ForEnhancement: string | null = null;
let uploadedImageOriginalNameForEnhancement: string | null = null;
const ENHANCE_IMAGE_COMMAND = "enhance this image";

// Initialize Gemini AI API Client.
let ai: GoogleGenAI | null = null;

/**
 * -----------------------------------------------------------------------------
 * AI INITIALIZATION FOR GEMINI (LOCAL DEPLOYMENT)
 * -----------------------------------------------------------------------------
 * This function handles initializing the Google Gemini AI client.
 * It expects the API key to be available as an environment variable.
 *
 * For local development, you can create a `.env` file in your project root:
 * API_KEY=YOUR_GEMINI_API_KEY
 *
 * And use a tool like `dotenv` to load it.
 */
async function initializeAi() {
    if (!process.env.API_KEY) {
        console.error("API Key not found. Please set the API_KEY environment variable.");
        const errorMessage = "AI configuration error: API key is missing. Please contact support.";
        const chatArea = document.getElementById('chat-messages');
        if (chatArea) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'flex mb-4 max-w-md justify-start mr-auto';
            errorDiv.innerHTML = `
                <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative" role="alert">
                    <strong class="font-bold">Configuration Error!</strong>
                    <span class="block sm:inline">The AI assistant could not be initialized. The API Key is missing.</span>
                </div>
            `;
            const initialGreetingElement = chatArea.querySelector('.flex.mb-4 > .bg-\\[\\#96B9AD\\]');
            if (initialGreetingElement && initialGreetingElement.parentElement) {
                initialGreetingElement.parentElement.remove();
            }
            chatArea.appendChild(errorDiv);
        }
        return; // UI remains disabled
    }

    try {
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        // Optional: Make a quick test call to verify the key is valid.
        await ai.models.generateContent({model: 'gemini-2.5-flash', contents: "test"});

        // AI is ready, enable the chat UI.
        if (userInput) userInput.disabled = false;
        if (chatSubmitButton) chatSubmitButton.disabled = false;
        if (quickOrderBtn) quickOrderBtn.disabled = false;
        if (uploadButton) uploadButton.disabled = false;
        console.log("Gemini AI Initialized Successfully.");

    } catch (error) {
        console.error("Failed to initialize Gemini AI:", error);
        const chatArea = document.getElementById('chat-messages');
        if (chatArea) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'flex mb-4 max-w-md justify-start mr-auto';
            errorDiv.innerHTML = `
                <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative" role="alert">
                    <strong class="font-bold">Initialization Error!</strong>
                    <span class="block sm:inline">Could not connect to the AI service. The API key might be invalid.</span>
                </div>
            `;
             const initialGreetingElement = chatArea.querySelector('.flex.mb-4 > .bg-\\[\\#96B9AD\\]');
            if (initialGreetingElement && initialGreetingElement.parentElement) {
                initialGreetingElement.parentElement.remove();
            }
            chatArea.appendChild(errorDiv);
        }
        // UI remains disabled on failure.
    }
}

// Helper to convert a base64 data URL to a Gemini Part
function dataURLtoPart(dataurl: string): Part {
  const match = dataurl.match(/^data:(.+);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid data URL format');
  }
  return { inlineData: { mimeType: match[1], data: match[2] } };
}

// --- Bot Knowledge Base ---
const websiteContext = `
    **## General Information ##**
    - **Business Name:** TheCakeBoxLady
    - **Tagline:** Gifting Happiness
    - **Location:** Siliguri, West Bengal, India (Home-based bakery)
    - **Contact:** WhatsApp: +91 7099032828, Email: tcblweb@gmail.com. You can find our contact information on the 'Contact Us' page of our website, usually at the bottom or in the main navigation.
    - **Response Time:** Please allow up to 4 hours for a reply on WhatsApp/Email.
    - **Working Hours:** 10:00 AM to 8:00 PM
    - **Order Type:** Pre-Orders Only
    - **Website:** https://www.thecakeboxlady.in/category/all-products. This is where you can explore designs, select preferences, and proceed to checkout for custom cakes.
    - **Gallery/Examples:** You can see examples of our custom cakes by visiting our 'Gallery' or 'Our Work' section on The Cake Box Lady website (https://www.thecakeboxlady.in/category/all-products), or check our Instagram: https://instagram.com/thecakeboxlady?utm_medium=copy_link.

    **## Products ##**
    - **Specialties:** Customized cakes, cupcakes, brownies, cheesecakes, gift hampers.
    - **Cake Flavors:** We offer a variety of delicious flavors for our custom cakes, including Chocolate and Butterscotch, and many others. You can find the available flavor options for each cake type on our website (https://www.thecakeboxlady.in/category/all-products). If you have a specific flavor request not listed, please reach out to us via WhatsApp or email.
    - **Cake Types:** Standard customized cakes, Bento (lunchbox) cakes. We specialize exclusively in custom cakes tailored to your specific needs and occasion. Every cake is made fresh to order! We do not offer ready-made cakes.
    - **Cupcakes:** Sold in boxes of 6.
    - **Cheesecakes:** New York Baked Cheesecake is a featured item.
    - **Brownies:** Fudgy brownies.
    - **Dietary Options:** We bake both egg and eggless cakes. You can choose your preference when customizing your order on our website (https://www.thecakeboxlady.in/category/all-products) or discussing on WhatsApp.
    - **Decorations:** We use both fresh cream and fondant for our cake decorations, depending on the design and your preference. When placing your custom cake order on our website (https://www.thecakeboxlady.in/category/all-products) or discussing on WhatsApp, you can specify your preferred frosting and decoration style.

    **## Ordering ##**
    - **How to Order:** You can easily order your custom cake directly through our website, https://www.thecakeboxlady.in/category/all-products. Just visit the site, explore our designs, select your preferences, and proceed to checkout. For urgent requests or highly complex custom designs, you may also contact us via WhatsApp (+91 7099032828).
    - **Lead Time:** For custom cakes, we recommend placing your order at least 2-3 days in advance to allow us sufficient time for baking and intricate decoration. Same-day delivery is generally not possible as each cake is made fresh to order; we require 24-48 hours notice. For urgent requests, please contact us directly on WhatsApp or email, and we'll do our best to accommodate.
    - **Pricing:** The starting price for our custom cakes varies based on size, design complexity, and ingredients. You can find base prices for different cake categories on our website (https://www.thecakeboxlady.in/category/all-products). For a precise quote, please design your cake online on our website or contact us with your specifications on WhatsApp (+91 7099032828).
    - **Design Specifics:** We specialize in custom cake designs! You can share your specific design ideas, themes, or reference images with us when placing your order on the website (https://www.thecakeboxlady.in/category/all-products - there will be an option to specify details or upload images), or contact us via WhatsApp to discuss your vision.
    - **Personalized Message:** Yes, you can add a personalized message to your custom cake. There's a dedicated field for this during the ordering process on our website (https://www.thecakeboxlady.in/category/all-products).

    **## Delivery ##**
    - **Service Area:** We offer delivery all over Siliguri ONLY. We do not deliver outside of Siliguri at this time.
    - **Cost:** Delivery is a paid service, and charges are extra. Delivery charges within Siliguri may vary based on your exact location. The delivery cost will be calculated and displayed during the checkout process on our website (https://www.thecakeboxlady.in/category/all-products) after you enter your delivery address.
    - **To Get a Quote:** The delivery cost will be calculated automatically on the website during checkout after you enter your address.

    **## Payment & Pricing Details ##**
    - **Payment Methods:** Currently, all orders placed through The Cake Box Lady website (https://www.thecakeboxlady.in/category/all-products) require online payment at the time of order placement. We do not offer Cash on Delivery (COD).
    - **Hidden Charges:** No, there are no hidden charges. The total cost including the cake price and delivery fees (if applicable) will be clearly displayed during the checkout process on our website (https://www.thecakeboxlady.in/category/all-products) before you make your payment.

    **## Post-Order & Support ##**
    - **Order Changes:** For any changes to a custom cake order after payment, please contact us as soon as possible at +91 7099032828 or tcblweb@gmail.com. Changes are subject to our ability to accommodate them based on the preparation stage and may incur extra costs.
    - **Refund Policy:** As our cakes are custom-made, our refund policy depends on the timing of the cancellation. Please refer to our 'Terms and Conditions' or 'Cancellation Policy' section on the website (https://www.thecakeboxlady.in/category/all-products) for full details. Generally, cancellations made well in advance may be eligible for a refund, but last-minute cancellations may not be.
    - **Corporate Ordering/Bulk Discounts:** Yes, we do cater to corporate events and large gatherings. Please contact us directly at +91 7099032828 or tcblweb@gmail.com with your requirements for bulk orders or corporate pricing, and we'll be happy to assist you with a custom quote.
    - **Issue with Order:** We strive for perfection with every cake. If you experience any issues with your order after delivery, please contact our customer support immediately at +91 7099032828 or tcblweb@gmail.com with your order details and photos, and we will assist you.
    - **Leaving a Review:** You can leave a review directly on the product page of the cake you ordered on our website (\\\`https://www.thecakeboxlady.in/category/all-products\\\`), or you can contact us via email (tcblweb@gmail.com), and we'd be happy to share your experience on our testimonials section.

    **## Cake Sizing in Pounds ##**
    - **Smallest Cake Size:** Our smallest custom cake size is typically around 2 pounds to 4 pounds, perfect for smaller celebrations. Please note that exact serving sizes can vary based on how generous the slices are.
    - **Cake for 10-12 people:** For 10-12 people, we would generally recommend a custom cake of approximately 2.5 to 3 pounds. This usually provides good portion sizes for everyone.
    - **Cake for 5-6 people:** For a small family gathering of 5-6 people, a custom cake of about 2 pounds to 3 pounds should be sufficient, offering a lovely treat for everyone.
    - **5 Pounds or Larger:** Yes, we can certainly bake custom cakes of 5 pounds or larger for bigger celebrations! Please specify the desired size and design when placing your order on our website (https://www.thecakeboxlady.in/category/all-products) or contact us to discuss options for larger events like weddings.

    **## Pet Cakes ##**
    - **Pet Cakes Offered:** Yes, we do! We offer custom-designed cakes for your furry friends, made with pet-safe ingredients. You can celebrate your pet's birthday or special occasion with a delicious and safe cake.
    - **Types of Pet Cakes:** We create custom cakes for dogs and cats, using ingredients that are safe for them to consume. Common ingredients include peanut butter, pumpkin, and other pet-friendly options. We can customize the design and size to suit your pet.
    - **Pet Cake Ingredients:** Our pet cakes are made with pet-safe ingredients like peanut butter, pumpkin, applesauce, and whole wheat flour. We avoid ingredients that are harmful to pets, such as chocolate, xylitol, and excessive sugar.
    - **Pet Cake Safety:** While our pet cakes are made with generally safe ingredients, it's always best to consult with your veterinarian if your pet has specific allergies or dietary restrictions. Please let us know of any concerns when placing your order.
    - **Customize Pet Cake:** Yes, absolutely! You can customize your pet's cake with their name, a specific design, or even a photo. Just let us know your preferences when placing your order.
    - **Pet Cake Sizes:** Our pet cakes typically come in smaller sizes, ranging from approximately 1 pound to 2 pounds, which are suitable for most pets. We can adjust the size based on your pet's breed and your needs.

    **## Kids' Cakes ##**
    - **Kids' Cakes Offered:** We have a fantastic collection of custom cakes for kids, featuring popular themes like superheroes, princesses, construction, hot air balloons, and more! You can explore our designs on our website's 'All Products' section (https://www.thecakeboxlady.in/category/all-products), which serves as our main gallery.
    - **Eggless Kids' Cakes:** Yes, absolutely! All our custom cakes for kids can be made in eggless variants. You can select the eggless option when placing your order on our website (https://www.thecakeboxlady.in/category/all-products).
    - **Kids' Cake Delivery in Siliguri:** Yes, we deliver all our custom cakes for kids across Siliguri. Just provide your delivery details when placing your order on our website (https://www.thecakeboxlady.in/category/all-products).
    - **Kids' Cake Pricing:** The price for our custom kids' cakes depends on the design complexity, size (in pounds), and specific customizations. You can get a detailed quote by selecting your preferences on our website's ordering page (https://www.thecakeboxlady.in/category/all-products), or by contacting us directly via WhatsApp (+91 7099032828) or email (tcblweb@gmail.com).
    - **Barbie Theme Cakes:** Yes, we do! We offer beautiful Barbie theme cakes that can be customized for your child's birthday. You can see examples of our designs on our website (https://www.thecakeboxlady.in/category/all-products).
    - **Frozen Theme Cakes:** Yes, we offer delightful Frozen theme cakes featuring characters like Elsa and Anna, perfect for a magical birthday celebration. You can find these on our website (https://www.thecakeboxlady.in/category/all-products).
    - **Superhero Theme Cakes (Avengers, Spiderman, Batman, Ladybug):** Absolutely! We have several popular superhero-themed cakes for kids, including designs featuring Avengers characters, Spiderman, Batman, and Ladybug. You can explore these exciting designs on our website (https://www.thecakeboxlady.in/category/all-products).
    - **Construction-Themed Cakes:** Yes, we offer fun construction-themed cakes, complete with diggers and caution signs, perfect for a little builder's birthday. You can find examples on our website (https://www.thecakeboxlady.in/category/all-products).
    - **Hot Air Balloon / Teddy Bear Themes:** Yes! We have adorable cakes featuring hot air balloons and teddy bears, available in various multi-tier or single-tier designs. You can find examples in our kids' cake collection on the website (https://www.thecakeboxlady.in/category/all-products).
    - **Customize Kids' Cake Colors/Characters:** Yes, since all our cakes are custom-made, you can absolutely customize the colors, characters, and other design elements to perfectly match your child's preferences for any of our kid's cakes. You can specify this when ordering on our website (https://www.thecakeboxlady.in/category/all-products) or via WhatsApp.
    - **Add Child's Name and Age:** Yes, personalized messages including your child's name and age are standard for our custom cakes. There will be an option to add this information during the ordering process on our website (https://www.thecakeboxlady.in/category/all-products).
    - **Kids' Party Sizing (15 children):** For a kids' party with around 15 children, we'd recommend a custom cake of approximately 4 to 5 pounds to ensure generous slices for everyone. You can specify the size when ordering on our website (https://www.thecakeboxlady.in/category/all-products) or via WhatsApp.

    **## Other ##**
    - **Baking Workshops:** For details about baking workshops, please send the message "BAKING WORKSHOP" on WhatsApp.
`;
const initialBotGreeting = "👋 Hello there! I'm your friendly AI assistant for TheCakeBoxLady. I'm excited to help you with cakes, orders, and any questions you have! What's on your mind today?";
let chatHistory: Content[] = [{
    role: "model",
    parts: [{ text: initialBotGreeting }]
}];

// --- Quick Order Flow State ---
let isOrdering = false;
let currentOrderStepKey: string | null = null; // Stores the key of the current question, or 'summary', or 'summary_confirmation'
const orderQuestions: { key: string; question: string; essential?: boolean }[] = [
    { key: "occasion", question: "Great! Let's get your order started. What's the occasion for the cake? (e.g., Birthday, Anniversary, Just Because)", essential: true },
    { key: "flavor", question: "What flavor would you like for your cake? (e.g., Chocolate, Vanilla, Butterscotch, Red Velvet, or ask for options)", essential: true },
    { key: "size", question: "What size cake do you need, or how many people should it serve?", essential: true },
    { key: "design", question: "Do you have any specific design ideas, theme, or colors in mind? You can describe it, or upload an image using the attach button. If uploading, type 'see image' or similar.", essential: true },
    { key: "dietary", question: "Would you prefer an egg-based or eggless cake? (e.g., Eggless, With Egg)" },
    { key: "message", question: "Is there any personalized message you'd like on the cake? (Type 'none' if not needed)" },
    { key: "date", question: "What date do you need the cake for?", essential: true },
    { key: "address", question: "What is the delivery address within Siliguri?", essential: true },
    { key: "name", question: "Can I get your name for the order?", essential: true },
    { key: "phone", question: "And lastly, what is a good contact phone number?", essential: true }
];
let currentOrderData: { [key: string]: string } = {};
const originalPlaceholder = "Ask about cakes, flavors, etc...";

// Interface for AI response during ordering
interface OrderAIResponse {
    updatedOrderData: { [key: string]: string };
    nextQuestionKey: string | null; // null if summary, or key of next q
    botResponseText: string;
}

// Interface for enhanced image bot message
interface EnhancedImageBotContent {
    text: string;
    enhancedImageUrl: string;
    originalFileName: string;
}

// Union type for getBotResponse return
type GetBotResponseResult = { text: string } | OrderAIResponse;


// --- File Upload Logic ---
if (uploadButton && fileInput) {
    uploadButton.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (event) => {
        const files = (event.target as HTMLInputElement).files;
        if (files && files.length > 0) {
            selectedFile = files[0];
            imageUploadedThisTurn = true; // Mark that an image is part of this turn
            if (selectedFile.size > 5 * 1024 * 1024) { // 5MB limit
                alert("File is too large. Please select an image under 5MB.");
                clearSelectedFile();
                return;
            }

            try {
                uploadedImageBase64ForEnhancement = await fileToBase64DataUrl(selectedFile);
                uploadedImageOriginalNameForEnhancement = selectedFile.name;
                showEnhanceImageQuickReply(); // This will now check isOrdering
            } catch (err) {
                console.error("Error preparing image for enhancement:", err);
                uploadedImageBase64ForEnhancement = null;
                uploadedImageOriginalNameForEnhancement = null;
                hideQuickReplies(); // Ensure enhance button is hidden if error
            }

            fileNameDisplay.textContent = selectedFile.name;
            filePreviewArea.classList.remove('hidden');
        }
    });
}

if (clearFileButton) {
    clearFileButton.addEventListener('click', clearSelectedFile);
}

function clearSelectedFile() {
    selectedFile = null;
    imageUploadedThisTurn = false;
    uploadedImageBase64ForEnhancement = null; // Clear for enhancement too
    uploadedImageOriginalNameForEnhancement = null;
    if (fileInput) fileInput.value = ''; // Reset file input
    if (filePreviewArea) filePreviewArea.classList.add('hidden');
    if (fileNameDisplay) fileNameDisplay.textContent = '';
    hideQuickReplies(); // Hide enhance button if file is cleared
}

async function fileToBase64DataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// --- Quick Reply Logic ---
function showOrderConfirmationQuickReplies() {
    if (!quickReplyContainer) return;
    quickReplyContainer.innerHTML = ''; // Clear previous buttons
    quickReplyContainer.classList.remove('hidden');

    const yesButton = document.createElement('button');
    yesButton.textContent = "Yes, Confirm 👍";
    yesButton.className = "bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-full shadow-md focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-75";
    yesButton.onclick = () => {
        processOrderConfirmation('yes');
        hideQuickReplies();
    };

    const noButton = document.createElement('button');
    noButton.textContent = "No, Start Over 🔄";
    noButton.className = "bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-full shadow-md focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-opacity-75";
    noButton.onclick = () => {
        processOrderConfirmation('no');
        hideQuickReplies();
    };

    quickReplyContainer.appendChild(yesButton);
    quickReplyContainer.appendChild(noButton);

    if (userInput) userInput.disabled = true;
    if (chatSubmitButton) chatSubmitButton.disabled = true;
}

function showEnhanceImageQuickReply() {
    if (!quickReplyContainer) return;

    // Reasons NOT to show the "Enhance Image" button:
    if (!uploadedImageBase64ForEnhancement || currentOrderStepKey === 'summary_confirmation' || isOrdering) {
        if (currentOrderStepKey !== 'summary_confirmation') {
            hideQuickReplies();
        }
        return; // Don't show the "Enhance Image" button
    }

    quickReplyContainer.innerHTML = ''; // Clear previous buttons
    quickReplyContainer.classList.remove('hidden');

    const enhanceButton = document.createElement('button');
    enhanceButton.textContent = "🎨 Enhance This Image";
    enhanceButton.className = "bg-purple-500 hover:bg-purple-600 text-white font-semibold py-2 px-4 rounded-full shadow-md focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-opacity-75 transition-all duration-150 ease-in-out transform hover:scale-105";
    enhanceButton.onclick = () => {
        handleEnhanceImageRequest();
    };
    quickReplyContainer.appendChild(enhanceButton);
    if (userInput) userInput.disabled = false;
    if (chatSubmitButton) chatSubmitButton.disabled = false;
}

function hideQuickReplies() {
    if (!quickReplyContainer) return;
    quickReplyContainer.innerHTML = '';
    quickReplyContainer.classList.add('hidden');
    // Re-enable input only if not in a state that explicitly disables it
    if (currentOrderStepKey !== 'summary_confirmation' && ai) {
        if (userInput) userInput.disabled = false;
        if (chatSubmitButton) chatSubmitButton.disabled = false;
    }
}

// --- Chat Form Submission ---
if (chatForm) {
    chatForm.onsubmit = async (e) => {
        e.preventDefault();

        if (currentOrderStepKey === 'summary_confirmation') {
            addMessageToUI('bot', "Please use the 'Yes' or 'No' buttons above to respond to the order summary. Typing is disabled for this step.");
            return;
        }

        const userMessageText = userInput.value.trim();
        if (!userMessageText && !selectedFile) return;

        // Handle enhance command via text
        if (userMessageText.toLowerCase().includes(ENHANCE_IMAGE_COMMAND) && uploadedImageBase64ForEnhancement && !isOrdering) {
            userInput.value = ''; // Clear input before handling
            await handleEnhanceImageRequest();
            return;
        }

        // Add user message to UI
        const uiMessageParts: { text?: string; filePreviewUrl?: string; fileName?: string }[] = [];
        if (userMessageText) {
            uiMessageParts.push({ text: userMessageText });
        }
        if (selectedFile) {
            uiMessageParts.push({ filePreviewUrl: URL.createObjectURL(selectedFile), fileName: selectedFile.name });
        }
        addMessageToUI('user', uiMessageParts);

        // Prepare message for Gemini API
        const userMessageParts: Part[] = [];
        if (userMessageText) {
            userMessageParts.push({ text: userMessageText });
        }
        
        if (selectedFile) {
            try {
                const imageBase64Data = await fileToBase64DataUrl(selectedFile);
                userMessageParts.push(dataURLtoPart(imageBase64Data));
            } catch (error) {
                console.error("Error converting file to base64 Part:", error);
                addMessageToUI('bot', "Sorry, there was an issue processing your uploaded file. Please try again.");
                clearSelectedFile();
                return;
            }
        }
        chatHistory.push({ role: "user", parts: userMessageParts });
        
        userInput.value = '';
        const justUploadedFile = selectedFile;
        clearSelectedFile();

        if (userMessageText.toLowerCase() === 'cancel order' && isOrdering) {
            isOrdering = false;
            currentOrderStepKey = null;
            currentOrderData = {};
            addMessageToUI('bot', "Okay, the quick order process has been cancelled. How else can I help you today? 👍");
            chatHistory.push({ role: "model", parts: [{text: "Quick order process cancelled by user."}] });
            if (userInput) userInput.placeholder = originalPlaceholder;
            hideQuickReplies();
            return;
        }

        typingIndicator.classList.remove('hidden');
        if (typingIndicatorText) typingIndicatorText.textContent = "Assistant is typing...";

        try {
            const botResponse = await getBotResponse(chatHistory, isOrdering, userMessageText, currentOrderData, orderQuestions, !!justUploadedFile);

            if (isOrdering) {
                if ('updatedOrderData' in botResponse) {
                    const orderAIResp = botResponse as OrderAIResponse;
                    currentOrderData = orderAIResp.updatedOrderData;
                    addMessageToUI('bot', orderAIResp.botResponseText);
                    chatHistory.push({ role: "model", parts: [{text: orderAIResp.botResponseText}] });

                    if (orderAIResp.nextQuestionKey === 'summary') {
                        currentOrderStepKey = 'summary_confirmation';
                        showOrderConfirmationQuickReplies();
                    } else {
                        currentOrderStepKey = orderAIResp.nextQuestionKey;
                        hideQuickReplies();
                    }
                } else {
                     throw new Error("Received unexpected response format during ordering.");
                }
            } else { // General Chat
                if ('text' in botResponse) {
                    chatHistory.push({ role: "model", parts: [{text: botResponse.text}] });
                    addMessageToUI('bot', botResponse.text);
                } else {
                     throw new Error("Received unexpected response format during general chat.");
                }
            }
        } catch (error) {
            console.error("Error during chat submission:", error);
            addMessageToUI('bot', 'Oops! Something went wrong. Please try again or use the "Place a Quick Order" feature. For immediate assistance, please contact us on WhatsApp at +91 7099032828 or email tcblweb@gmail.com.');
        } finally {
            typingIndicator.classList.add('hidden');
        }
    };
}


// --- Image Enhancement Logic ---
async function handleEnhanceImageRequest() {
    if (!ai) {
        addMessageToUI('bot', "AI service is not initialized yet. Please wait a moment and try again. 🛠️");
        return;
    }
    if (!uploadedImageBase64ForEnhancement || !uploadedImageOriginalNameForEnhancement) {
        addMessageToUI('bot', "It seems there's no image ready for enhancement. Please upload an image first. 😊");
        hideQuickReplies();
        return;
    }
     if (isOrdering) {
        addMessageToUI('bot', "Image enhancement isn't available while placing an order. The uploaded image will be used for your cake design.");
        hideQuickReplies();
        return;
    }

    addMessageToUI('user', [{ text: "Please enhance the uploaded image." }]);
    chatHistory.push({ role: "user", parts: [{text: `User requested enhancement for image: ${uploadedImageOriginalNameForEnhancement}`}] });

    typingIndicator.classList.remove('hidden');
    if (typingIndicatorText) typingIndicatorText.textContent = "🎨 Crafting enhancement idea...";

    const imageBase64ToEnhance = uploadedImageBase64ForEnhancement;
    const originalFileName = uploadedImageOriginalNameForEnhancement;

    uploadedImageBase64ForEnhancement = null;
    uploadedImageOriginalNameForEnhancement = null;
    hideQuickReplies();

    try {
        // Step 1: Generate a creative prompt for Imagen using Gemini
        const promptGenerationSystemInstruction = `You are an expert image editor. Based on the user's uploaded image, generate a detailed text prompt for an AI image generation model (like Imagen) to create an 'enhanced' version. The enhanced version should have improved vibrancy, clarity, sharpness, and overall aesthetic appeal. If it's food, make it look more delicious. If it's a person, enhance their features naturally. If it's a landscape, make the colors rich and details crisp. The generated prompt should describe the image's content and append these enhancement qualities. For example, for an image of 'a cat on a red sofa', the prompt might be 'A photorealistic cat sleeping on a vibrant red sofa, detailed fur, sharp focus, warm and inviting lighting, enhanced for aesthetic appeal.' Output only the generated prompt text, nothing else.`;
        const imagePart = dataURLtoPart(imageBase64ToEnhance);

        const promptResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { text: "Generate an enhancement prompt for this image." },
                    imagePart,
                ]
            },
            config: {
                systemInstruction: promptGenerationSystemInstruction,
            }
        });
        
        const imagenPrompt = promptResponse.text.trim();
        if (!imagenPrompt) {
            throw new Error("AI failed to generate a creative prompt for the image.");
        }
        
        addMessageToUI('bot', `Ok, I have an idea for enhancing "${originalFileName}"! Working on it...`);
        chatHistory.push({ role: "model", parts: [{text: `Generated Imagen prompt: ${imagenPrompt}`}] });

        if (typingIndicatorText) typingIndicatorText.textContent = "✨ Generating enhanced image...";
        
        // Step 2: Generate image using Imagen
        const imageResponse = await ai.models.generateImages({
            model: 'imagen-3.0-generate-002',
            prompt: imagenPrompt,
            config: {
              numberOfImages: 1,
              outputMimeType: 'image/jpeg',
              aspectRatio: '1:1',
            },
        });
        
        const base64ImageBytes: string = imageResponse.generatedImages[0].image.imageBytes;
        const imageUrl = `data:image/jpeg;base64,${base64ImageBytes}`;

        const enhancedImageContent: EnhancedImageBotContent = {
            text: "Ta-da! Here's an AI-enhanced version:",
            enhancedImageUrl: imageUrl,
            originalFileName: originalFileName
        };
        addMessageToUI('bot', enhancedImageContent);
        chatHistory.push({ role: "model", parts: [{text: "Displayed enhanced image."}, dataURLtoPart(imageUrl)]});

    } catch (error) {
        console.error("Error during image enhancement:", error);
        addMessageToUI('bot', `Oops! We encountered an issue while trying to enhance your image. This might be a temporary problem. Please try again in a few moments. Error: ${(error as Error).message}`);
        chatHistory.push({ role: "model", parts: [{text: `Error during enhancement: ${(error as Error).message}`}] });
    } finally {
        typingIndicator.classList.add('hidden');
        if (typingIndicatorText) typingIndicatorText.textContent = "Assistant is typing...";
    }
}


// --- Order Celebration Animation ---
async function triggerOrderCelebrationAnimation(): Promise<void> {
    if (!orderCelebrationAnimationEl || !celebrationCakeContainerEl || !celebrationThankYouEl) {
        console.warn("Celebration animation elements not found. Skipping animation.");
        return Promise.resolve();
    }

    return new Promise(resolve => {
        orderCelebrationAnimationEl.style.display = 'flex';
        celebrationCakeContainerEl.className = 'absolute inset-0 flex items-center justify-center';
        celebrationThankYouEl.className = 'absolute inset-0 flex items-center justify-center text-white text-4xl font-bold opacity-0';
        celebrationCakeContainerEl.classList.add('cake-pop-in');

        setTimeout(() => {
            celebrationCakeContainerEl.classList.remove('cake-pop-in');
            celebrationCakeContainerEl.classList.add('cake-blast-out');
            celebrationThankYouEl.classList.add('thank-you-reveal');

            setTimeout(() => {
                orderCelebrationAnimationEl.style.display = 'none';
                celebrationCakeContainerEl.classList.remove('cake-blast-out');
                celebrationThankYouEl.classList.remove('thank-you-reveal');
                resolve();
            }, 2000);
        }, 800);
    });
}

// Function to simulate sending order notification to business
function simulateSendOrderNotification(orderData: { [key: string]: string }, fullChatHistory: Content[]) {
    const recipientEmail = "tcblweb@gmail.com";
    const subject = `New Quick Order Request - ${orderData['name'] || 'Unknown Customer'}`;

    let emailBody = `A new quick order request has been submitted:\n\n`;
    orderQuestions.forEach(q => {
        emailBody += `${q.question.split('?')[0].split('.')[0]}: ${orderData[q.key] || 'Not provided'}\n`;
    });
    emailBody += `\n---------------------\n`;
    emailBody += `Full Conversation History (for context):\n`;

    fullChatHistory.forEach(entry => {
        emailBody += `\n[${entry.role.toUpperCase()}]\n`;
        entry.parts.forEach(part => {
             if ('text' in part && part.text) {
                emailBody += `${part.text}\n`;
            } else if ('inlineData' in part) {
                 emailBody += `(User attached an image)\n`;
            }
        });
    });

    const payload = { to: recipientEmail, subject, body: emailBody, orderData };

    console.log("--- SIMULATING ORDER NOTIFICATION ---");
    console.log("Recipient:", payload.to);
    console.log("Subject:", payload.subject);
    console.log("Email Body (first 500 chars):", payload.body.substring(0, 500) + "...");
    console.log("Full Order Data:", payload.orderData);
    console.log("-------------------------------------");

    const emailModal = document.getElementById('email-notification-modal') as HTMLElement;
    const emailTo = document.getElementById('email-to') as HTMLElement;
    const emailSubject = document.getElementById('email-subject') as HTMLElement;
    const emailBodyContent = document.getElementById('email-body-content') as HTMLElement;
    const closeEmailModalBtn = document.getElementById('close-email-modal-btn') as HTMLButtonElement;

    if (emailModal && emailTo && emailSubject && emailBodyContent && closeEmailModalBtn) {
        emailTo.textContent = payload.to;
        emailSubject.textContent = payload.subject;
        emailBodyContent.textContent = payload.body;
        emailModal.style.display = 'flex';

        const closeModalHandler = () => {
            emailModal.style.display = 'none';
            closeEmailModalBtn.removeEventListener('click', closeModalHandler);
        };
        closeEmailModalBtn.addEventListener('click', closeModalHandler);
    }
}


async function processOrderConfirmation(userConfirmation: string) {
    if (userConfirmation.toLowerCase() === 'yes') {
        await triggerOrderCelebrationAnimation();
        const finalMessage = `Thank you, ${currentOrderData['name'] || 'customer'}! We've received your quick order request. Our team will review your order and get in touch with you at ${currentOrderData['phone'] || 'the provided number'} within approximately 4 working hours (during 10 AM - 8 PM) to confirm the details, provide a final quote, and arrange payment. Please note, this order is tentative until confirmed by our team. 🎉`;
        addMessageToUI('bot', finalMessage);
        chatHistory.push({ role: "model", parts: [{text: "Order confirmed by user. Final instructions given."}] });
        simulateSendOrderNotification(currentOrderData, chatHistory);
    } else {
        addMessageToUI('bot', "Okay, the order request has been cancelled. Feel free to start a new quick order or ask any other questions! 😊");
        chatHistory.push({ role: "model", parts: [{text: "User declined order summary and order was cancelled."}] });
    }

    isOrdering = false;
    currentOrderStepKey = null;
    currentOrderData = {};
    if (userInput) userInput.placeholder = originalPlaceholder;
    hideQuickReplies();
}

function linkifyText(text: string): string {
    const urlRegex = /(\b(?:https?:\/\/|www\.)[^\s<>"',;()]+)/gi;
    let linkifiedText = text.replace(urlRegex, (match) => {
        const url = match.startsWith('www.') ? `http://${match}` : match;
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 hover:underline">${match}</a>`;
    });
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi;
    linkifiedText = linkifiedText.replace(emailRegex, (match) => `<a href="mailto:${match}" class="text-blue-600 hover:text-blue-800 hover:underline">${match}</a>`);
    const whatsappRegex = /(?:WhatsApp\s*:\s*)?(\+91\s*70990\s*32828)/gi;
    linkifiedText = linkifiedText.replace(whatsappRegex, (match) => `<a href="https://wa.me/917099032828" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 hover:underline">${match}</a>`);
    return linkifiedText;
}


// --- UI Display ---
function addMessageToUI(sender: 'user' | 'bot',
                        content: string | { text?: string, filePreviewUrl?: string, fileName?: string }[] | EnhancedImageBotContent) {
    const messageWrapper = document.createElement('div');
    messageWrapper.classList.add('flex', 'mb-4', 'max-w-md');
    messageWrapper.setAttribute('aria-live', 'polite');

    const messageBubble = document.createElement('div');
    messageBubble.classList.add('rounded-lg', 'p-3', 'text-base');

    let htmlContent = '';

    if (sender === 'user') {
        messageWrapper.classList.add('justify-end', 'ml-auto');
        messageBubble.classList.add('bg-gray-500', 'text-white', 'message-pop-in');
        if (Array.isArray(content)) {
            content.forEach(part => {
                if (part.text) {
                    htmlContent += part.text.replace(/\n/g, '<br>') + '<br>';
                } else if (part.filePreviewUrl && part.fileName) {
                    const imgElement = document.createElement('img');
                    imgElement.src = part.filePreviewUrl;
                    imgElement.alt = part.fileName;
                    imgElement.classList.add('max-w-xs', 'max-h-48', 'my-2', 'rounded');
                    imgElement.onload = () => URL.revokeObjectURL(imgElement.src);
                    messageBubble.appendChild(imgElement);
                }
            });
        }
    } else { // Bot message
        messageWrapper.classList.add('justify-start', 'mr-auto');
        messageBubble.classList.add('bg-[#EAF0EE]', 'text-black');

        let textToDisplay = '';
        
        if (typeof content === 'object' && 'enhancedImageUrl' in content) {
            const botContent = content as EnhancedImageBotContent;
            textToDisplay = botContent.text;

            const enhancedImgElement = document.createElement('img');
            enhancedImgElement.src = botContent.enhancedImageUrl;
            enhancedImgElement.alt = `Enhanced version of ${botContent.originalFileName}`;
            enhancedImgElement.classList.add('max-w-xs', 'max-h-60', 'my-2', 'rounded', 'border-2', 'border-purple-300', 'shadow-lg');
            messageBubble.appendChild(enhancedImgElement);

            const downloadLink = document.createElement('a');
            downloadLink.href = botContent.enhancedImageUrl;
            const safeFileName = botContent.originalFileName.replace(/\.[^/.]+$/, "").replace(/\s+/g, '_');
            downloadLink.download = `enhanced_${safeFileName}.png`;
            downloadLink.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1.5 inline-block" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>Download Enhanced Image`;
            downloadLink.className = 'block text-center mt-2.5 text-xs bg-purple-500 hover:bg-purple-600 text-white font-semibold py-2 px-3 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-opacity-75 transition-colors duration-150';
            messageBubble.appendChild(downloadLink);

        } else if (typeof content === 'string') {
            textToDisplay = content;
        }
        
        const linkifiedBotText = linkifyText(textToDisplay);
        htmlContent = linkifiedBotText.replace(/\n/g, '<br>');
    }

    const textNode = document.createElement('div');
    textNode.classList.add('break-words');
    textNode.innerHTML = htmlContent.trim().replace(/<br>(<br>)+$/, '').replace(/<br>$/, '');
    if (textNode.innerHTML || messageBubble.querySelector('img')) {
         messageBubble.appendChild(textNode);
    }
    
    if (messageBubble.innerHTML.trim() !== '' || messageBubble.querySelector('img')) {
        messageWrapper.appendChild(messageBubble);
        if (chatMessages) {
            chatMessages.appendChild(messageWrapper);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }
}


function createSystemInstructionForOrderParsing(
    currentOrderDetails: { [key: string]: string },
    allOrderQuestions: { key: string; question: string; essential?:boolean }[],
    latestUserMessage: string,
    imageProvided: boolean
): string {
    const stringifiedOrderData = JSON.stringify(currentOrderDetails);
    const stringifiedOrderQuestions = JSON.stringify(allOrderQuestions.map(q => ({key: q.key, question: q.question, essential: q.essential})));

    const today = new Date();
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
    const currentDateFormatted = today.toLocaleDateString(undefined, options);

    const earliestDeliveryDate = new Date(today);
    earliestDeliveryDate.setDate(today.getDate() + 3);
    const earliestDateFormatted = earliestDeliveryDate.toLocaleDateString(undefined, options);

    return `You are an intelligent order-taking assistant for "TheCakeBoxLady". Your goal is to provide a friendly and efficient ordering experience by guiding the user through placing a custom cake order.
Your task is to populate a JSON object based on the conversation.
The user's latest message is: "${latestUserMessage}".
${imageProvided ? "The user has also uploaded an image for the design. Acknowledge this (e.g., 'Thanks for the design image!')." : ""}

**Order Fields to Collect:**
${stringifiedOrderQuestions}
'essential' fields are required.

**Current Order Data:**
${stringifiedOrderData}

**Your Instructions:**
1.  Analyze the user's latest message to extract information for ANY of the order fields.
2.  Update the 'Current Order Data' with any newly extracted information in the 'updatedOrderData' field of your JSON response.
3.  Determine the NEXT logical question to ask. Prioritize empty 'essential' fields.
4.  If all 'essential' fields are filled, it's time for a summary.
    - Set 'nextQuestionKey' to "summary".
    - 'botResponseText' must be a friendly, comprehensive summary of ALL collected data, formatted with newlines (e.g., "Okay, let's review your order: 🎂\\nOccasion: Birthday\\nFlavor: Chocolate..."). Conclude by asking for confirmation ("Does this look correct?").
5.  If not ready for summary:
    - Set 'nextQuestionKey' to the key of the next question to ask (e.g., "flavor").
    - 'botResponseText' should be your natural language question for that field.

**Date Validation Rule:** Today is ${currentDateFormatted}. Our lead time is 2-3 days, so the earliest possible delivery is ${earliestDateFormatted}. If a user requests an earlier date, politely explain the lead time and suggest the earliest possible date. Normalize the date into a clear format (e.g., Month Day, Year).

Your response will be structured as a JSON object, adhering to the schema provided.
`;
}

// --- Main AI Response Generation ---
async function getBotResponse(
    history: Content[],
    isOrderingFlow: boolean,
    latestUserMessage: string = '',
    currentOrder: { [key: string]: string } = {},
    orderQs: { key: string; question: string; essential?: boolean }[] = [],
    imageProvided: boolean = false
): Promise<GetBotResponseResult> {
    if (!ai) {
        throw new Error("Gemini AI client is not initialized.");
    }
    
    const model = "gemini-2.5-flash";
    
    if (isOrderingFlow) {
        const systemInstruction = createSystemInstructionForOrderParsing(currentOrder, orderQs, latestUserMessage, imageProvided);
        const orderResponseSchema = {
            type: Type.OBJECT,
            properties: {
                updatedOrderData: {
                    type: Type.OBJECT,
                    description: "An object containing all the order details collected so far."
                },
                nextQuestionKey: {
                    type: Type.STRING,
                    description: "The key of the next question to ask, or 'summary'."
                },
                botResponseText: {
                    type: Type.STRING,
                    description: "The bot's natural language response to the user."
                },
            },
            required: ['updatedOrderData', 'nextQuestionKey', 'botResponseText'],
        };
        
        const response = await ai.models.generateContent({
            model: model,
            contents: history,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: orderResponseSchema,
                temperature: 0.5,
            }
        });

        try {
            const parsedResponse: OrderAIResponse = JSON.parse(response.text);
            if (parsedResponse && typeof parsedResponse.updatedOrderData === 'object' && typeof parsedResponse.botResponseText === 'string') {
                return parsedResponse;
            } else {
                 throw new Error("Parsed JSON response is missing required fields.");
            }
        } catch (e) {
            console.error("Failed to parse JSON response from Gemini:", e, "\nRaw response:", response.text);
            return {
                botResponseText: "I'm having a little trouble with the order details right now. Could you please rephrase that?",
                nextQuestionKey: currentOrderStepKey,
                updatedOrderData: currentOrder
            };
        }
    } else {
         const systemInstruction = `You are a friendly, helpful, and concise AI shopping assistant for "TheCakeBoxLady", a home bakery in Siliguri. Your persona is warm, inviting, and slightly playful. Use emojis to enhance the tone 🎂🍰✨.
Your role is to answer user questions based *strictly* on the provided "Website Context".
Do not invent details. If the answer is not in the context, say you don't have that information and suggest contacting the bakery directly.
Gently guide users towards ordering. If they ask about cakes, mention they can start a "Quick Order" using the button.
If a user's message clearly indicates they want to start an order (e.g., "I want to order a cake"), respond with a message that prompts them to use the "Place a Quick Order 🍰" button for a streamlined experience. For example: "It sounds like you're ready to order! For the best experience, please use the 'Place a Quick Order 🍰' button below. It will guide you through all the necessary steps!"
Do not confuse an uploaded image for enhancement with an order, unless the user is in the ordering flow.

**Website Context:**
${websiteContext}
`;
        const response = await ai.models.generateContent({
            model: model,
            contents: history,
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.7,
            },
        });
        
        return { text: response.text };
    }
}


// --- Quick Order Button Logic ---
if (quickOrderBtn) {
    quickOrderBtn.onclick = () => {
        if (!ai) {
             addMessageToUI('bot', 'AI service is not ready. Please wait a moment.');
             return;
        }
        isOrdering = true;
        currentOrderStepKey = orderQuestions[0].key;
        currentOrderData = {};
        
        const firstQuestion = orderQuestions[0].question;
        addMessageToUI('bot', firstQuestion);
        chatHistory.push({ role: "model", parts: [{text: firstQuestion}] });

        if (userInput) {
            userInput.placeholder = "Type your answer here...";
            userInput.focus();
        }
        hideQuickReplies();
    };
}

// --- Chat Widget Toggle and Refresh Logic ---
const handleRefreshChat = () => {
    if (confirm("Are you sure you want to refresh the chat? This will clear the conversation history.")) {
        if (chatMessages) chatMessages.style.opacity = '0';
        setTimeout(() => {
            isOrdering = false;
            currentOrderStepKey = null;
            currentOrderData = {};
            uploadedImageBase64ForEnhancement = null;
            uploadedImageOriginalNameForEnhancement = null;
            
            if (chatMessages) chatMessages.innerHTML = '';
            if (userInput) {
                userInput.value = '';
                userInput.placeholder = originalPlaceholder;
                userInput.disabled = !ai;
            }
            if (chatSubmitButton) chatSubmitButton.disabled = !ai;
            clearSelectedFile();
            hideQuickReplies();

            chatHistory = [{ role: "model", parts: [{ text: initialBotGreeting }] }];
            addMessageToUI('bot', initialBotGreeting);
            if (chatMessages) chatMessages.style.opacity = '1';
        }, 300);
    }
};

if (chatbotHeader) {
    chatbotHeader.addEventListener('click', handleRefreshChat);
}

if (chatWidgetContainer && openChatWidgetBtn && closeChatWidgetBtn) {
    const showWidget = () => {
        chatWidgetContainer.classList.remove('hidden');
        openChatWidgetBtn.classList.add('hidden');
        setTimeout(() => userInput?.focus(), 100);
    };
    const hideWidget = () => {
        chatWidgetContainer.classList.add('hidden');
        openChatWidgetBtn.classList.remove('hidden');
    };
    hideWidget();
    openChatWidgetBtn.addEventListener('click', showWidget);
    closeChatWidgetBtn.addEventListener('click', hideWidget);
}


// --- Initial Setup ---
document.addEventListener('DOMContentLoaded', () => {
    if (userInput) userInput.disabled = true;
    if (chatSubmitButton) chatSubmitButton.disabled = true;
    if (quickOrderBtn) quickOrderBtn.disabled = true;
    if (uploadButton) uploadButton.disabled = true;
    initializeAi();
});