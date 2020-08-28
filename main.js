// ==UserScript==
// @name         Buda <3 Fintual
// @namespace    https://fintual.cl
// @version      0.1
// @description  Ver el saldo de bitcoins en Fintual
// @author       @borismacias
// @match        https://fintual.cl/
// @require      http://crypto.stanford.edu/sjcl/sjcl.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/js-sha512/0.8.0/sha512.min.js
// @grant    GM_getValue
// @grant    GM_setValue
// @grant    GM_registerMenuCommand
// @grant    GM.xmlHttpRequest
// ==/UserScript==



function buildHTML(capital) {
  return '<div class="fintual-app-goal-item">' +
           '<a class="fintual-app-goal-item__link" href="#"></a>' +
           '<div class="fintual-app-goal-item__details">' +
             '<div class="fintual-app-goal-item__name fintual-app-goal-item__name--deposited">' +
               '<span>Bitcoins ₿</span>' +
             '</div>' +
           '</div>' +
           '<div class="fintual-app-goal-item__status-detail">' +
             '<div class="fintual-app-goal-item__amount">'+ capital +'</div>' +
           '</div>' +
         '</div>'
}

function checkEncKey() {
  let encKey = GM_getValue('encKey', '');

  if (!encKey) {
    encKey = prompt(
      'Necesitamos un texto random para poder encriptar tus datos. Porfa ingresa cualquier texto:',
    );
    GM_setValue('encKey', encKey);
  }
}

function buildMenuCommands() {
  GM_registerMenuCommand('Cambiar API Key', changeApiKey);
  GM_registerMenuCommand('Cambiar API Secret', changeApiSecret);
}


function changeApiKey() {
  promptAndChangeStoredValue('Api key', 'apiKey');
  rebuildBitcoinContainerInnerHtml('Recarga la página 🙏🏼')
}

function changeApiSecret() {
  promptAndChangeStoredValue('Api secret', 'apiSecret');
  rebuildBitcoinContainerInnerHtml('Recarga la página 🙏🏼')
}

function promptAndChangeStoredValue(userPrompt, setValVarName) {
  let targVar = prompt('Cambiar ' + userPrompt, '');
  GM_setValue(setValVarName, encryptAndStore(targVar));
}

function rebuildBitcoinContainerInnerHtml(amount) {
  let bitcoinContainer = document.getElementById('bitcoin-container');
  bitcoinContainer.innerHTML = buildHTML(amount)
}

function decodeOrPrompt(targVar, userPrompt, setValVarName) {
  if (!targVar) {
    targVar = prompt(userPrompt + ' no está seteada. Ingrésala acá:','');
    GM_setValue(setValVarName, encryptAndStore(targVar));
  }
  else {
    targVar = unStoreAndDecrypt(targVar);
  }
  return targVar;
}

function encryptAndStore(clearText) {
  const encKey = GM_getValue('encKey', '');
  return JSON.stringify(sjcl.encrypt(encKey, clearText));
}

function unStoreAndDecrypt(jsonObj) {
  const encKey = GM_getValue('encKey', '');
  return sjcl.decrypt(encKey, JSON.parse(jsonObj));
}

function fillCapital(key, secret){
  const nonce = getNonce();
  const baseURL = 'https://www.buda.com';
  const balancePath = '/api/v2/balances';
  const unsignedString = 'GET ' + balancePath + ' ' + nonce;
  const signature = sha384.hmac(secret, unsignedString);
  const balanceUrl = baseURL + balancePath;

  GM.xmlHttpRequest({
    method: "GET",
    url: balanceUrl,
    headers: {
      'X-SBTC-APIKEY': key,
      'X-SBTC-SIGNATURE': signature,
      'X-SBTC-NONCE': nonce
    },
    onload: function(balanceResponse) {
      const parsedBalanceResponse = JSON.parse(balanceResponse.responseText);
      const btcBalance = parsedBalanceResponse.balances.find(function(balance){ return balance.id === "BTC"});
      const btcAmount = parseFloat(btcBalance.available_amount[0]);

      GM.xmlHttpRequest({
        method: "POST",
        headers: {
            'Accept': 'application/json',
            "Content-Type": "application/json"
        },
        url: "https://www.buda.com/api/v2/markets/btc-clp/quotations",
        data: JSON.stringify({type: "bid_given_earned_base",amount: btcAmount + ""}),
        dataType: 'json',
        contentType: 'application/json',
        overrideMimeType: 'application/json',
        onload: function (quotationResponse) {
          const parsedQuotationResponse = JSON.parse(quotationResponse.responseText);
          const capital = parsedQuotationResponse.quotation.quote_exchanged[0];
          rebuildBitcoinContainerInnerHtml(currencyFormattedAmount(capital))
        }
      })
    }
  });
}

function currencyFormattedAmount(amount, decimalCount = 0, decimal = ",", thousands = ".") {
  try {
    decimalCount = Math.abs(decimalCount);
    decimalCount = isNaN(decimalCount) ? 2 : decimalCount;

    const negativeSign = amount < 0 ? "-" : "";

    let i = parseInt(amount = Math.abs(Number(amount) || 0).toFixed(decimalCount)).toString();
    let j = (i.length > 3) ? i.length % 3 : 0;

    return '$ ' + negativeSign + (j ? i.substr(0, j) + thousands : '') + i.substr(j).replace(/(\d{3})(?=\d)/g, "$1" + thousands) + (decimalCount ? decimal + Math.abs(amount - i).toFixed(decimalCount).slice(2) : "");
  } catch (e) {
    console.log(e)
  }
}

function getNonce() {
  return Date.now();
}

(function() {
    'use strict';

    checkEncKey();
    buildMenuCommands();
    let key = GM_getValue('apiKey', '');
    let secret = GM_getValue('apiSecret', '');
    key = decodeOrPrompt(key, 'ApiKey de Buda', 'apiKey');
    secret = decodeOrPrompt(secret, 'ApiSecret de Buda', 'apiSecret');
    if(!key || !secret){
      alert("Necesitamos tu key y secret para poder mostrar tu balance.")
    };

    let goalsContainers = document.getElementsByClassName('fintual-app-goal-items');
    let base = goalsContainers[goalsContainers.length - 1];
    let bitcoinContainer = document.createElement('div');
    bitcoinContainer.setAttribute('id','bitcoin-container');
    base.append(bitcoinContainer);
    bitcoinContainer.innerHTML = buildHTML("Hablando con Buda ...");
    fillCapital(key, secret);
})();
