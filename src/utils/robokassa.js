import md5 from 'blueimp-md5';

const MERCHANT_LOGIN = import.meta.env.VITE_ROBOKASSA_MERCHANT_LOGIN;
const PASSWORD1 = import.meta.env.VITE_ROBOKASSA_PASSWORD1;
const IS_TEST = import.meta.env.VITE_ROBOKASSA_IS_TEST === '1';

/**
 * Build Shp_* parameters string for signature calculation.
 * Robokassa requires custom Shp_ params sorted alphabetically.
 * @param {Object} shpParams - Object with keys WITHOUT "Shp_" prefix
 * @returns {string} - e.g. "Shp_plan=1%20%D0%9C%D0%B5%D1%81%D1%8F%D1%86:Shp_telegram_id=123"
 */
function buildShpString(shpParams) {
  return Object.keys(shpParams)
    .sort()
    .map(key => `Shp_${key}=${shpParams[key]}`)
    .join(':');
}

/**
 * Generate SignatureValue for Robokassa payment initiation.
 * Formula: MD5(MerchantLogin:OutSum:InvId:Password1[:Shp_key=value...])
 *
 * @param {Object} params
 * @param {string|number} params.outSum - Payment amount (e.g. "499.00")
 * @param {number} params.invId - Order ID from payment_orders table
 * @param {Object} [params.shpParams] - Custom Shp_ parameters (without prefix)
 * @returns {string} - Uppercase MD5 hash
 */
export function generateSignature({ outSum, invId, shpParams = {} }) {
  const shpString = buildShpString(shpParams);
  const base = `${MERCHANT_LOGIN}:${outSum}:${invId}:${PASSWORD1}`;
  const signString = shpString ? `${base}:${shpString}` : base;
  return md5(signString).toUpperCase();
}

/**
 * Open Robokassa payment iFrame via Robokassa.StartPayment().
 * Requires the Robokassa script to be loaded in index.html.
 *
 * @param {Object} params
 * @param {string} params.outSum - Amount like "499.00"
 * @param {number} params.invId - Order ID from Supabase payment_orders
 * @param {string} params.description - Payment description (max 100 chars)
 * @param {Object} [params.shpParams] - Custom Shp_ params without prefix
 */
export function startRobokassaPayment({ outSum, invId, description, shpParams = {} }) {
  if (!window.Robokassa) {
    console.error('[Robokassa] Script not loaded. Check that index.html includes robokassa_iframe.js');
    throw new Error('Robokassa script not loaded');
  }

  if (!MERCHANT_LOGIN || !PASSWORD1) {
    console.error('[Robokassa] Missing env variables: VITE_ROBOKASSA_MERCHANT_LOGIN or VITE_ROBOKASSA_PASSWORD1');
    throw new Error('Robokassa configuration missing');
  }

  const signature = generateSignature({ outSum, invId, shpParams });

  const paymentParams = {
    MerchantLogin: MERCHANT_LOGIN,
    OutSum: outSum,
    InvId: invId,
    Description: description,
    Culture: 'ru',
    Encoding: 'utf-8',
    SignatureValue: signature,
    // Spread custom Shp_ params
    ...Object.fromEntries(
      Object.entries(shpParams).map(([k, v]) => [`Shp_${k}`, v])
    ),
  };

  // Add IsTest flag only in test mode
  if (IS_TEST) {
    paymentParams.IsTest = 1;
  }

  console.log('[Robokassa] Starting payment', { invId, outSum, isTest: IS_TEST });
  window.Robokassa.StartPayment(paymentParams);
}
