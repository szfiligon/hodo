import jwt from 'jsonwebtoken';

// JWT密钥 - 在生产环境中应该从环境变量获取
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// JWT载荷接口
export interface JWTPayload {
  userId: string;
  username: string;
  iat?: number;
  exp?: number;
}

/**
 * 生成JWT令牌
 * @param userId 用户ID
 * @param username 用户名
 * @returns JWT令牌
 */
export function generateToken(userId: string, username: string): string {
  const payload: JWTPayload = {
    userId,
    username,
  };

  return jwt.sign(payload, JWT_SECRET); // 不传expiresIn，实现永久不过期
}

/**
 * 验证JWT令牌
 * @param token JWT令牌
 * @returns 解码后的载荷或null
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * 从请求头中提取JWT令牌
 * @param authorizationHeader Authorization头
 * @returns JWT令牌或null
 */
export function extractTokenFromHeader(authorizationHeader: string | null): string | null {
  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    return null;
  }
  
  return authorizationHeader.substring(7); // 移除 'Bearer ' 前缀
} 