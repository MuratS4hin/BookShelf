import React, { useEffect, useState } from 'react';
import { Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LocalLibraryStorage from '../services/LocalLibraryStorage';
import { useHIGTheme } from '../theme/hig';

/**
 * Renders an on-device book cover (native file:// or web IndexedDB idb://) with clean cleanup.
 */
export default function LocalCoverImage({ book, style, iconSize = 20 }) {
  const theme = useHIGTheme();
  const [resolvedUri, setResolvedUri] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    let revoke = () => {};
    setFailed(false);

    if (!book?.imageUrl) {
      setResolvedUri(null);
      return undefined;
    }

    LocalLibraryStorage.resolveCoverUri(book)
      .then((res) => {
        if (!mounted) {
          res.revoke?.();
          return;
        }
        revoke = res.revoke || (() => {});
        setResolvedUri(res.uri || null);
      })
      .catch(() => {
        if (mounted) {
          setResolvedUri(null);
        }
      });

    return () => {
      mounted = false;
      revoke();
    };
  }, [book?.id, book?.imageUrl]);

  if (!resolvedUri || failed) {
    const isPlainPdf =
      (book?.fileType || '').toLowerCase() === 'pdf' && !book?.audioPath;
    return (
      <Ionicons
        name={isPlainPdf ? 'document-text-outline' : 'book-outline'}
        size={iconSize}
        color={theme.colors.labelSecondary}
      />
    );
  }

  return (
    <Image
      source={{ uri: resolvedUri }}
      style={style}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
}
