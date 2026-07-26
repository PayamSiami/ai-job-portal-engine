import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
async function testProxyOnly() {
    console.log('🔍 Testing proxy connection...');
    console.log('📡 Proxy: http://127.0.0.1:10808');
    const proxyAgent = new HttpsProxyAgent('http://127.0.0.1:10808');
    try {
        const ipResponse = await axios.get('https://api.ipify.org?format=json', {
            httpsAgent: proxyAgent,
            timeout: 10000,
        });
        console.log('✅ Proxy is working!');
        console.log('📍 Your IP:', ipResponse.data.ip);
        const locationResponse = await axios.get('http://ip-api.com/json/', {
            httpsAgent: proxyAgent,
            timeout: 10000,
        });
        console.log('📍 Country:', locationResponse.data.country);
        console.log('📍 Country Code:', locationResponse.data.countryCode);
        return true;
    }
    catch (error) {
        console.error('❌ Proxy test failed:', error.message);
        console.log('\n💡 Check:');
        console.log('   1. Is V2Ray running?');
        console.log('   2. Is the port correct? (10808)');
        console.log('   3. Is V2Ray connected?');
        return false;
    }
}
testProxyOnly();
