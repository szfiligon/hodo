import React, { useState, useEffect, forwardRef } from 'react';
import { Button, Typography } from '@mui/material';

interface UserInfoProps {
  onLoginClick: () => void;
}

const UserInfo = forwardRef<{ refresh: () => Promise<void> }, UserInfoProps>(({ onLoginClick }, ref) => {
  const [username, setUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserInfo = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/user');
      const data = await response.json();
      
      if (response.ok) {
        setUsername(data.username);
      }
    } catch (error) {
      console.error('Error fetching user info:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUserInfo();
  }, []);

  React.useImperativeHandle(
    ref,
    () => ({
      refresh: fetchUserInfo
    }),
    [fetchUserInfo]
  );

  return (
    <Button
      variant="contained"
      color="primary"
      onClick={onLoginClick}
      sx={{ width: '100%', marginTop: 'auto' }}
    >
      {isLoading ? (
        '加载中...'
      ) : username ? (
        <Typography variant="body2" sx={{ textTransform: 'none' }}>
          当前用户: {username}
        </Typography>
      ) : (
        '登录'
      )}
    </Button>
  );
});

export default UserInfo; 