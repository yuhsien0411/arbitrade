/**
 * 格式化工具函數
 */

/**
 * 格式化金額並添加幣種
 * @param amount 金額
 * @param currency 幣種符號
 * @returns 格式化後的金額字符串
 */
export const formatAmountWithCurrency = (amount: number, currency: string = 'USDT'): string => {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return '0';
  }

  // 如果是整數，顯示為整數；如果有小數，保留最多8位小數
  const formattedAmount = Number(amount) % 1 === 0 
    ? amount.toLocaleString()
    : amount.toLocaleString(undefined, { 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 8 
      });

  return `${formattedAmount} ${currency}`;
};

/**
 * 格式化百分比
 * @param value 數值
 * @param decimals 小數位數
 * @returns 格式化後的百分比字符串
 */
export const formatPercentage = (value: number, decimals: number = 2): string => {
  if (typeof value !== 'number' || isNaN(value)) {
    return '0%';
  }

  return `${value.toFixed(decimals)}%`;
};

/**
 * 格式化價格
 * @param price 價格
 * @param decimals 小數位數
 * @returns 格式化後的價格字符串
 */
export const formatPrice = (price: number, decimals: number = 4): string => {
  if (typeof price !== 'number' || isNaN(price)) {
    return '0';
  }

  return price.toFixed(decimals);
};