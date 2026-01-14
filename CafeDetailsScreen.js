import React, { useEffect, useState } from 'react';
import { View, Text, Image } from 'react-native';
import ReviewForm from './ReviewForm';
import CafeDetailsTabs from './CafeDetailsTab';
import { getFirestore, collection, query, orderBy, onSnapshot, addDoc, doc } from 'firebase/firestore';
import { firebaseApp, auth } from './firebase';
import { GOOGLE_MAPS_API_KEY } from '@env';
import { globalStyles, colors } from './globalStyles';
import { Dimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

const screenHeight = Dimensions.get('window').height;
const db = getFirestore(firebaseApp);

const foodKeywords = ['matcha', 'sandwich', 'tiramisu'];

function extractMenuKeywords(reviews) {
  const counts = {};
  reviews.forEach(({ text }) => {
    if (!text) return;
    const comment = text.toLowerCase();
    foodKeywords.forEach(keyword => {
      if (comment.includes(keyword)) {
        counts[keyword] = (counts[keyword] || 0) + 1;
      }
    });
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word);
}

export default function CafeDetailsScreen() {
  const params = useLocalSearchParams();
  const cafe = JSON.parse(params.cafe);

  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [googleReviews, setGoogleReviews] = useState([]);
  const [loadingGoogleReviews, setLoadingGoogleReviews] = useState(true);
  const [googleAvgRating, setGoogleAvgRating] = useState(null);
  const [googleTotalRatings, setGoogleTotalRatings] = useState(0);
  const [friendIds, setFriendIds] = useState([]);

  const currentUser = auth.currentUser;

  const photoUrl = cafe.photos?.[0]?.photo_reference
    ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${cafe.photos[0].photo_reference}&key=${GOOGLE_MAPS_API_KEY}`
    : null;

  useEffect(() => {
    if (!currentUser?.uid) return;
    const userDocRef = doc(db, 'users', currentUser.uid);
    return onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) setFriendIds(docSnap.data().friends || []);
    });
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, 'cafes', cafe.place_id, 'reviews'),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (querySnapshot) => {
      const revs = [];
      querySnapshot.forEach(doc => revs.push({ id: doc.id, ...doc.data() }));
      setReviews(revs);
      setLoadingReviews(false);
    });
  }, []);

  useEffect(() => {
    async function fetchGoogleReviews() {
      try {
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${cafe.place_id}&fields=reviews,rating,user_ratings_total&key=${GOOGLE_MAPS_API_KEY}`
        );
        const data = await res.json();
        setGoogleReviews(data.result?.reviews || []);
        setGoogleAvgRating(data.result?.rating || null);
        setGoogleTotalRatings(data.result?.user_ratings_total || 0);
      } catch {
        setGoogleReviews([]);
      } finally {
        setLoadingGoogleReviews(false);
      }
    }
    fetchGoogleReviews();
  }, []);

  const menuKeywords = extractMenuKeywords(googleReviews);

  const handleReviewSubmit = async (review) => {
    await addDoc(collection(db, 'cafes', cafe.place_id, 'reviews'), {
      ...review,
      createdAt: new Date(),
      username: currentUser?.email || 'Anonymous',
      userId: currentUser?.uid,
    });
  };

  const yourAvgRating =
    reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length).toFixed(1)
      : null;

  const friendAndMyReviews = reviews.filter(
    r => r.userId === currentUser?.uid || friendIds.includes(r.userId)
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.rosyPink }}>
      <View style={{ flexDirection: 'row', height: screenHeight * 0.3, padding: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={globalStyles.title}>{cafe.name}</Text>
          <Text style={globalStyles.address}>{cafe.vicinity || ''}</Text>
        </View>

        {photoUrl && (
          <Image
            source={{ uri: photoUrl }}
            style={{ width: 150, height: 150, borderRadius: 10 }}
          />
        )}
      </View>

      <CafeDetailsTabs
        reviews={reviews}
        loadingReviews={loadingReviews}
        friendAndMyReviews={friendAndMyReviews}
        loadingGoogleReviews={loadingGoogleReviews}
        menuKeywords={menuKeywords}
        cafe={cafe}
        handleReviewSubmit={handleReviewSubmit}
        googleAvgRating={googleAvgRating}
        googleTotalRatings={googleTotalRatings}
        yourAvgRating={yourAvgRating}
      />
    </View>
  );
}
