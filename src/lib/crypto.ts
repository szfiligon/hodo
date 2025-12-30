import { readFileSync } from 'fs';
import { join } from 'path';
import crypto from 'crypto';

/**
 * 解密方法
 * @param encryptedAesKeyAndIv RSA加密的AES密钥和IV（前32位是密钥，后面是IV）
 * @param encryptedData AES加密的密文
 * @returns 解密后的明文
 */
export function decryptData(encryptedAesKeyAndIv: string, encryptedData: string): string {
  try {
    // 读取RSA私钥
    const privateKeyPath = join(process.cwd(), 'public', 'auth');
    const privateKey = readFileSync(privateKeyPath, 'utf8');
    
    // 使用RSA私钥解密AES密钥和IV
    const decryptedBuffer = crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      Buffer.from(encryptedAesKeyAndIv, 'base64')
    );
    
    // 提取AES密钥（前32位字符）和IV（剩余字符）
    const decryptedString = decryptedBuffer.toString('utf8');
    const aesKeyString = decryptedString.substring(0, 32);
    const ivString = decryptedString.substring(32);
    
    // 将字符串转换为Buffer
    const aesKey = Buffer.from(aesKeyString, 'utf8');
    const iv = Buffer.from(ivString, 'utf8');
    
    // 创建AES解密器
    const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
    
    // 解密数据
    let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error(`解密失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 解密方法（异步版本）
 * @param encryptedAesKeyAndIv RSA加密的AES密钥和IV（前32位是密钥，后面是IV）
 * @param encryptedData AES加密的密文
 * @returns Promise<string> 解密后的明文
 */
export async function decryptDataAsync(encryptedAesKeyAndIv: string, encryptedData: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const result = decryptData(encryptedAesKeyAndIv, encryptedData);
      resolve(result);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 验证RSA私钥是否有效
 * @returns boolean
 */
export function validatePrivateKey(): boolean {
  try {
    const privateKeyPath = join(process.cwd(), 'public', 'auth');
    const privateKey = readFileSync(privateKeyPath, 'utf8');
    
    // 尝试创建私钥对象来验证格式
    crypto.createPrivateKey(privateKey);
    return true;
  } catch (error) {
    console.error('RSA私钥验证失败:', error);
    return false;
  }
} 