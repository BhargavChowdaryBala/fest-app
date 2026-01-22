const crypto = require('crypto');
const axios = require('axios');

async function testPayment() {
    const MERCHANT_ID = "MERCHANTUAT";
    const SALT_KEY = "099eb0cd-02cf-4e2a-8aca-3e6c6aff0399";
    const SALT_INDEX = 1;
    const HOST_URL = "https://api-preprod.phonepe.com/apis/hermes";
    const ENDPOINT = "/pg/v1/pay";

    const merchantTransactionId = 'MT' + Date.now();
    const userId = 'MUID' + Date.now();

    const data = {
        merchantId: MERCHANT_ID,
        merchantTransactionId: merchantTransactionId,
        merchantUserId: userId,
        amount: 10000,
        redirectUrl: "http://localhost:3000/callback",
        redirectMode: "POST",
        callbackUrl: "http://localhost:3000/callback",
        mobileNumber: "9999999999",
        paymentInstrument: {
            type: "PAY_PAGE"
        }
    };

    const payload = JSON.stringify(data);
    const payloadMain = Buffer.from(payload).toString('base64');

    // Checksum = sha256(base64 + endpoint + salt) + ### + index
    const string = payloadMain + ENDPOINT + SALT_KEY;
    const sha256 = crypto.createHash('sha256').update(string).digest('hex');
    const checksum = sha256 + '###' + SALT_INDEX;

    console.log("Making Request to:", HOST_URL + ENDPOINT);
    console.log("X-VERIFY:", checksum);

    try {
        const response = await axios.post(
            HOST_URL + ENDPOINT,
            { request: payloadMain },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-VERIFY': checksum,
                    'accept': 'application/json'
                }
            }
        );
        console.log("SUCCESS!");
        console.log(JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error("FAILED!");
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
    }
}

testPayment();
