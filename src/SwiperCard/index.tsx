import React, {
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  type PropsWithChildren,
} from 'react';
import { useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { SwiperCardOptions, SwiperCardRefType } from 'rn-swiper-list';

import OverlayLabel from './OverlayLabel';

const VELOCITY_THRESHOLD = 500;
const POSITION_THRESHOLD = 0.3;

const SwipeBackUserConfig = {
  damping: 15,
  stiffness: 120,
  mass: 0.5,
  overshootClamping: false,
  restDisplacementThreshold: 0.001,
  restSpeedThreshold: 0.001,
};

const SwipeableCard = forwardRef<
  SwiperCardRefType,
  PropsWithChildren<SwiperCardOptions>
>(
  (
    {
      index,
      activeIndex,
      onSwipeLeft,
      onSwipeRight,
      onSwipeTop,
      onSwipeBottom,
      cardStyle,
      children,
      disableRightSwipe,
      disableLeftSwipe,
      disableTopSwipe,
      disableBottomSwipe,
      translateXRange,
      translateYRange,
      rotateInputRange,
      rotateOutputRange,
      inputOverlayLabelRightOpacityRange,
      outputOverlayLabelRightOpacityRange,
      inputOverlayLabelLeftOpacityRange,
      outputOverlayLabelLeftOpacityRange,
      inputOverlayLabelTopOpacityRange,
      outputOverlayLabelTopOpacityRange,
      inputOverlayLabelBottomOpacityRange,
      outputOverlayLabelBottomOpacityRange,
      OverlayLabelRight,
      OverlayLabelLeft,
      OverlayLabelTop,
      OverlayLabelBottom,
      onSwipeStart,
      onSwipeActive,
      onSwipeEnd,
    },
    ref
  ) => {
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const currentActiveIndex = useSharedValue(Math.floor(activeIndex.value));
    const nextActiveIndex = useSharedValue(Math.floor(activeIndex.value));

    const { width, height } = useWindowDimensions();
    const maxCardTranslation = width * 1.5;
    const maxCardTranslationY = height * 1.5;

    const swipeRight = useCallback(() => {
      onSwipeRight?.(index);
      translateX.value = withSpring(maxCardTranslation);
      activeIndex.value++;
    }, [index, activeIndex, maxCardTranslation, onSwipeRight, translateX]);

    const swipeLeft = useCallback(() => {
      onSwipeLeft?.(index);
      translateX.value = withSpring(-maxCardTranslation);
      activeIndex.value++;
    }, [index, activeIndex, maxCardTranslation, onSwipeLeft, translateX]);

    const swipeTop = useCallback(() => {
      onSwipeTop?.(index);
      translateY.value = withSpring(-maxCardTranslationY);
      activeIndex.value++;
    }, [index, activeIndex, maxCardTranslationY, onSwipeTop, translateY]);

    const swipeBottom = useCallback(() => {
      onSwipeBottom?.(index);
      translateY.value = withSpring(maxCardTranslationY);
      activeIndex.value++;
    }, [index, activeIndex, maxCardTranslationY, onSwipeBottom, translateY]);

    const swipeBack = useCallback(() => {
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      translateX.value = withSpring(0, SwipeBackUserConfig);
      translateY.value = withSpring(0, SwipeBackUserConfig);
    }, [translateX, translateY]);

    useImperativeHandle(
      ref,
      () => {
        return {
          swipeLeft,
          swipeRight,
          swipeBack,
          swipeTop,
          swipeBottom,
        };
      },
      [swipeLeft, swipeRight, swipeBack, swipeTop, swipeBottom]
    );

    const inputRangeX = React.useMemo(() => {
      return translateXRange ?? [];
    }, [translateXRange]);
    const inputRangeY = React.useMemo(() => {
      return translateYRange ?? [];
    }, [translateYRange]);
    const rotateX = useDerivedValue(() => {
      return interpolate(
        translateX.value,
        rotateInputRange ?? [],
        rotateOutputRange ?? [],
        'clamp'
      );
    }, [inputRangeX]);

    const gesture = Gesture.Pan()
      .onBegin(() => {
        currentActiveIndex.value = Math.floor(activeIndex.value);
        if (onSwipeStart) runOnJS(onSwipeStart)();
      })
      .onUpdate((event) => {
        if (currentActiveIndex.value !== index) return;
        if (onSwipeActive) runOnJS(onSwipeActive)();

        translateX.value = event.translationX;
        translateY.value = event.translationY;

        if (height / 3 < Math.abs(event.translationY)) {
          nextActiveIndex.value = interpolate(
            translateY.value,
            inputRangeY,
            [
              currentActiveIndex.value + 1,
              currentActiveIndex.value,
              currentActiveIndex.value + 1,
            ],
            'clamp'
          );
          return;
        }

        nextActiveIndex.value = interpolate(
          translateX.value,
          inputRangeX,
          [
            currentActiveIndex.value + 1,
            currentActiveIndex.value,
            currentActiveIndex.value + 1,
          ],
          'clamp'
        );
      })
      .onFinalize((event) => {
        if (currentActiveIndex.value !== index) return;
        if (onSwipeEnd) runOnJS(onSwipeEnd)();

        const velocityX = Math.abs(event.velocityX);
        const velocityY = Math.abs(event.velocityY);
        const isHorizontalSwipe = velocityX > velocityY;

        const horizontalThresholdMet =
          Math.abs(event.translationX) > width * POSITION_THRESHOLD ||
          velocityX > VELOCITY_THRESHOLD;
        const verticalThresholdMet =
          Math.abs(event.translationY) > height * POSITION_THRESHOLD ||
          velocityY > VELOCITY_THRESHOLD;

        if (isHorizontalSwipe && horizontalThresholdMet) {
          const sign = Math.sign(event.translationX);
          if (sign === 1 && !disableRightSwipe) {
            runOnJS(swipeRight)();
            return;
          }
          if (sign === -1 && !disableLeftSwipe) {
            runOnJS(swipeLeft)();
            return;
          }
        } else if (!isHorizontalSwipe && verticalThresholdMet) {
          const sign = Math.sign(event.translationY);
          if (sign === -1 && !disableTopSwipe) {
            runOnJS(swipeTop)();
            return;
          }
          if (sign === 1 && !disableBottomSwipe) {
            runOnJS(swipeBottom)();
            return;
          }
        }

        translateX.value = withSpring(0, SwipeBackUserConfig);
        translateY.value = withSpring(0, SwipeBackUserConfig);
      });

    const rCardStyle = useAnimatedStyle(() => {
      const opacity = withTiming(index - activeIndex.value < 2 ? 1 : 0);
      const scale = withTiming(1 - 0.07 * (index - activeIndex.value));

      return {
        opacity,
        position: 'absolute',
        zIndex: -index,
        transform: [
          { rotate: `${rotateX.value}rad` },
          { scale: scale },
          { translateX: translateX.value },
          { translateY: translateY.value },
        ],
      };
    });

    if (index - Math.floor(activeIndex.value) >= 2) {
      return null;
    }

    return (
      <GestureDetector gesture={gesture}>
        <Animated.View style={[cardStyle, rCardStyle]}>
          {OverlayLabelLeft && (
            <OverlayLabel
              inputRange={inputOverlayLabelLeftOpacityRange}
              outputRange={outputOverlayLabelLeftOpacityRange}
              Component={OverlayLabelLeft}
              opacityValue={translateX}
            />
          )}
          {OverlayLabelRight && (
            <OverlayLabel
              inputRange={inputOverlayLabelRightOpacityRange}
              outputRange={outputOverlayLabelRightOpacityRange}
              Component={OverlayLabelRight}
              opacityValue={translateX}
            />
          )}
          {OverlayLabelTop && (
            <OverlayLabel
              inputRange={inputOverlayLabelTopOpacityRange}
              outputRange={outputOverlayLabelTopOpacityRange}
              Component={OverlayLabelTop}
              opacityValue={translateY}
            />
          )}
          {OverlayLabelBottom && (
            <OverlayLabel
              inputRange={inputOverlayLabelBottomOpacityRange}
              outputRange={outputOverlayLabelBottomOpacityRange}
              Component={OverlayLabelBottom}
              opacityValue={translateY}
            />
          )}

          {children}
        </Animated.View>
      </GestureDetector>
    );
  }
);

export default memo(SwipeableCard);
