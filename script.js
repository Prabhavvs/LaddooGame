class LaddooGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        // Base logical size (constant game space)
        this.baseWidth = 375;
        this.baseHeight = 667;
        this.gameWidth = this.baseWidth;
        this.gameHeight = this.baseHeight;
        
        // Game state
        this.gameRunning = false;
        this.score = 0;
        this.targetScore = 10;
        this.timeLeft = 15; // 15 seconds
        this.timer = null;
        
        // Character
        this.catcher = {
            x: this.gameWidth / 2 - 30,
            y: this.gameHeight - 80,
            width: 60,
            height: 60,
            speed: 5
        };
        
        // Laddoos
        this.laddoos = [];
        this.laddooSpawnRate = 0.015; // Probability per frame (increased from 0.008)
        this.laddooSpeed = 2.5;
        this.spawnPadding = 60; // allow spawning slightly offscreen to increase effective width
        
        // Bad objects (ball, poop, hanger, boots)
        this.badObjects = [];
        this.badObjectSpawnRate = 0.015; // Increased spawn rate for bad objects
        this.badObjectSpeed = 2.5;
        this.badObjectTypes = ['ball', 'poop', 'hanger', 'boots'];
        
        // Controls
        this.keys = {};
        this.touchControls = {
            left: false,
            right: false
        };
        
        // Touch position tracking
        this.touchStartX = 0;
        this.touchCurrentX = 0;
        this.isTouching = false;
        
        // Assets
        this.images = {};
        this.imageSources = {
            laddoo: 'assets/laddoo.png',
            ball: 'assets/ball.png',
            poop: 'assets/poop.png',
            hanger: 'assets/hanger.png',
            boots: 'assets/boots.png',
            charOpen: 'assets/character-open.png',
            charClosed: 'assets/character-neutral.png',
            minusOne: 'assets/-1.png',
            lost: 'assets/lost.png',
            lostBg: 'assets/lost bg.png',
            cry: 'assets/cry.png',
            won: 'assets/won.png',
            wonBg: 'assets/won bg.png',
            trophy: 'assets/trophy.png'
        };
        this.currentCharImage = 'charOpen';
        this.mouthTimeoutId = null;
        
        // -1 Animation
        this.minusOneAnimations = [];
        this.showMinusOne = false;
        this.minusOneTimeout = null;
        this.minusOneAlpha = 0;
        this.minusOneScale = 0.5;
        
        // Crying Animation for Lose Screen
        this.cryingDrops = [];
        this.cryingAnimationId = null;
        this.cryingCanvas = null;
        this.cryingCtx = null;
        
        // Trophy Animation for Win Screen
        this.trophyDrops = [];
        this.trophyAnimationId = null;
        this.trophyCanvas = null;
        this.trophyCtx = null;
        
        // Confetti Animation for Win Screen
        this.confettiAnimation = null;
        this.confettiContainer = null;
        
        this.loadImages();
        window.addEventListener('resize', () => this.resizeCanvas());
        this.resizeCanvas();
    }

    loadImages() {
        let loadedImages = 0;
        const numImages = Object.keys(this.imageSources).length;
        
        for (const key in this.imageSources) {
            this.images[key] = new Image();
            this.images[key].src = this.imageSources[key];
            this.images[key].onload = () => {
                loadedImages++;
                if (loadedImages === numImages) {
                    this.init(); // Only initialize after all images are loaded
                }
            };
            this.images[key].onerror = () => {
                console.error(`Failed to load image: ${this.imageSources[key]}`);
                loadedImages++;
                if (loadedImages === numImages) {
                    this.init(); // Initialize even if some images fail
                }
            };
        }
    }
    
    init() {
        this.setupEventListeners();
        this.gameLoop();
    }
    
    setupEventListeners() {
        // Start button
        document.getElementById('startBtn').addEventListener('click', () => {
            this.startGame();
        });
        
        // Play again button
        document.getElementById('playAgainBtn').addEventListener('click', () => {
            this.restartGame();
        });
        
        // Try again button
        document.getElementById('tryAgainBtn').addEventListener('click', () => {
            this.startGame();
        });
        
        // Close buttons
        document.querySelectorAll('.close-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.resetGame();
            });
        });
        
        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
        });
        
        // Touch controls for mobile - ultra smooth version
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.isTouching = true;
            this.touchStartX = e.touches[0].clientX;
            this.touchCurrentX = e.touches[0].clientX;
        }, { passive: false });
        
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (this.isTouching && e.touches.length > 0) {
                this.touchCurrentX = e.touches[0].clientX;
            }
        }, { passive: false });
        
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.isTouching = false;
            this.touchControls.left = false;
            this.touchControls.right = false;
        }, { passive: false });
        
        this.canvas.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            this.isTouching = false;
            this.touchControls.left = false;
            this.touchControls.right = false;
        }, { passive: false });
        
        // Prevent scrolling on the entire game container
        document.getElementById('gameContainer').addEventListener('touchmove', (e) => {
            e.preventDefault();
        }, { passive: false });
        
        // Optional on-screen controls (if present)
        const leftBtn = document.getElementById('leftBtn');
        const rightBtn = document.getElementById('rightBtn');
        if (leftBtn && rightBtn) {
            leftBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.touchControls.left = true; });
            leftBtn.addEventListener('touchend',   (e) => { e.preventDefault(); this.touchControls.left = false; });
            rightBtn.addEventListener('touchstart',(e) => { e.preventDefault(); this.touchControls.right = true; });
            rightBtn.addEventListener('touchend',  (e) => { e.preventDefault(); this.touchControls.right = false; });
            leftBtn.addEventListener('mousedown',  () => { this.touchControls.left = true; });
            leftBtn.addEventListener('mouseup',    () => { this.touchControls.left = false; });
            rightBtn.addEventListener('mousedown', () => { this.touchControls.right = true; });
            rightBtn.addEventListener('mouseup',   () => { this.touchControls.right = false; });
        }
    }
    
    startGame() {
        // Show countdown screen first
        this.showCountdown();
    }
    
    showCountdown() {
        // Hide other screens
        document.getElementById('startScreen').classList.remove('active');
        document.getElementById('winScreen').classList.remove('active');
        document.getElementById('loseScreen').classList.remove('active');
        document.getElementById('gameScreen').classList.remove('active');
        
        // Show countdown screen
        document.getElementById('countdownScreen').classList.add('active');
        
        // Start countdown
        this.startCountdown();
    }
    
    startCountdown() {
        const countdownElement = document.getElementById('countdownNumber');
        
        // Show 3 first
        countdownElement.textContent = '3';
        countdownElement.style.animation = 'countdownPulse 1s ease-in-out';
        
        setTimeout(() => {
            // Show 2
            countdownElement.textContent = '2';
            countdownElement.style.animation = 'none';
            countdownElement.offsetHeight; // Trigger reflow
            countdownElement.style.animation = 'countdownPulse 1s ease-in-out';
            
            setTimeout(() => {
                // Show 1
                countdownElement.textContent = '1';
                countdownElement.style.animation = 'none';
                countdownElement.offsetHeight; // Trigger reflow
                countdownElement.style.animation = 'countdownPulse 1s ease-in-out';
                
                setTimeout(() => {
                    // Start game
                    this.startActualGame();
                }, 1000);
            }, 1000);
        }, 1000);
    }
    
    startActualGame() {
        this.gameRunning = true;
        this.score = 0;
        this.timeLeft = 15;
        this.laddoos = [];
        this.badObjects = [];
        
        // Stop crying animation
        this.stopCryingAnimation();
        
        // Stop trophy animation
        this.stopTrophyAnimation();
        
        // Stop confetti animation
        this.stopConfettiAnimation();
        
        // Hide countdown screen and show game screen
        document.getElementById('countdownScreen').classList.remove('active');
        document.getElementById('gameScreen').classList.add('active');
        
        // Start timer
        this.startTimer();
    }
    
    startTimer() {
        // Initialize timer bar to show 0% filled
        this.updateTimerBar();
        
        this.timer = setInterval(() => {
            this.timeLeft--;
            this.updateTimerBar();
            
            if (this.timeLeft <= 0) {
                this.endGame();
            }
        }, 1000);
    }
    
    updateTimerBar() {
        const timerFill = document.getElementById('timerFill');
        const timerText = document.getElementById('timerText');
        const percentage = ((15 - this.timeLeft) / 15) * 100; // Fill from 0% to 100% as time runs out
        timerFill.style.width = percentage + '%';
        timerText.textContent = Math.ceil(this.timeLeft) + ' seconds';
    }
    
    endGame() {
        this.gameRunning = false;
        clearInterval(this.timer);
        
        if (this.score >= this.targetScore) {
            this.showWinScreen();
        } else {
            this.showLoseScreen();
        }
    }
    
    showWinScreen() {
        document.getElementById('gameScreen').classList.remove('active');
        document.getElementById('loseScreen').classList.remove('active');
        document.getElementById('winScreen').classList.add('active');

        // Initialize trophy canvas
        this.trophyCanvas = document.getElementById('trophyCanvas');
        this.trophyCtx = this.trophyCanvas.getContext('2d');

        // Initialize confetti container
        this.confettiContainer = document.getElementById('confettiContainer');

        // Start trophy animation
        this.startTrophyAnimation();
        
        // Start confetti animation
        this.startConfettiAnimation();
    }
    
    showLoseScreen() {
        document.getElementById('gameScreen').classList.remove('active');
        document.getElementById('winScreen').classList.remove('active');
        document.getElementById('loseScreen').classList.add('active');
        
        // Initialize crying canvas
        this.cryingCanvas = document.getElementById('cryingCanvas');
        this.cryingCtx = this.cryingCanvas.getContext('2d');
        
        // Start crying animation
        this.startCryingAnimation();
    }
    
    showGameOver() {
        // For now, just reset to start screen
        // You can add a game over screen later
        this.resetGame();
    }
    
    resetGame() {
        this.gameRunning = false;
        this.score = 0;
        this.timeLeft = 15;
        this.laddoos = [];
        this.badObjects = [];
        
        if (this.timer) {
            clearInterval(this.timer);
        }
        
        // Stop all animations
        this.stopCryingAnimation();
        this.stopTrophyAnimation();
        this.stopConfettiAnimation();
        
        // Reset catcher position
        this.catcher.x = this.gameWidth / 2 - 30;
        
        // Hide all screens
        document.getElementById('startScreen').classList.remove('active');
        document.getElementById('countdownScreen').classList.remove('active');
        document.getElementById('gameScreen').classList.remove('active');
        document.getElementById('winScreen').classList.remove('active');
        document.getElementById('loseScreen').classList.remove('active');
        
        // Show start screen
        document.getElementById('startScreen').classList.add('active');
        
        // Reset timer bar
        this.updateTimerBar();
    }
    
    restartGame() {
        this.gameRunning = false;
        this.score = 0;
        this.timeLeft = 15;
        this.laddoos = [];
        this.badObjects = [];
        
        if (this.timer) {
            clearInterval(this.timer);
        }
        
        // Reset catcher position
        this.catcher.x = this.gameWidth / 2 - 30;
        
        // Go directly to game screen (skip start screen)
        document.getElementById('startScreen').classList.remove('active');
        document.getElementById('winScreen').classList.remove('active');
        document.getElementById('gameScreen').classList.add('active');
        
        // Start the game immediately
        this.startGame();
    }
    
    update() {
        // Update crying drops (always update, even on lose screen)
        this.updateCryingDrops();
        
        // Update trophy drops (always update, even on win screen)
        this.updateTrophyDrops();
        
        if (!this.gameRunning) return;
        
        // Handle character movement
        this.handleMovement();
        
        // Spawn laddoos
        this.spawnLaddoos();
        
        // Spawn bad objects
        this.spawnBadObjects();
        
        // Update laddoos
        this.updateLaddoos();
        
        // Update bad objects
        this.updateBadObjects();
        
        // Check collisions
        this.checkCollisions();
        
        // Update -1 animation
        this.updateMinusOneAnimation();
    }
    
    handleMovement() {
        // Keyboard controls
        if (this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A']) {
            this.catcher.x -= this.catcher.speed;
        }
        if (this.keys['ArrowRight'] || this.keys['d'] || this.keys['D']) {
            this.catcher.x += this.catcher.speed;
        }
        
        // Touch controls - ultra smooth swipe gesture
        if (this.isTouching) {
            const touchDelta = this.touchCurrentX - this.touchStartX;
            const sensitivity = 0.8; // Increased for more responsive movement
            
            // Ultra smooth movement based on touch delta
            if (Math.abs(touchDelta) > 2) { // Very small threshold for immediate response
                const movement = touchDelta * sensitivity;
                this.catcher.x += movement;
                
                // Smooth reset for continuous movement without drift
                this.touchStartX += movement * 0.5;
            }
        }
        
        // Touch controls - button controls
        if (this.touchControls.left) {
            this.catcher.x -= this.catcher.speed;
        }
        if (this.touchControls.right) {
            this.catcher.x += this.catcher.speed;
        }
        
        // Keep catcher within bounds
        this.catcher.x = Math.max(0, Math.min(this.gameWidth - this.catcher.width, this.catcher.x));
    }
    
    spawnLaddoos() {
        if (Math.random() < this.laddooSpawnRate) {
            this.laddoos.push({
                x: -this.spawnPadding + Math.random() * (this.baseWidth - 50 + this.spawnPadding * 2),
                y: -30,
                width: 50,
                height: 50,
                speed: this.laddooSpeed + Math.random() * 2,
                type: 'laddoo'
            });
        }
    }
    
    spawnBadObjects() {
        if (Math.random() < this.badObjectSpawnRate) {
            const randomType = this.badObjectTypes[Math.floor(Math.random() * this.badObjectTypes.length)];
            this.badObjects.push({
                x: -this.spawnPadding + Math.random() * (this.baseWidth - 50 + this.spawnPadding * 2),
                y: -30,
                width: 50,
                height: 50,
                speed: this.badObjectSpeed + Math.random() * 2,
                type: randomType
            });
        }
    }
    
    updateLaddoos() {
        for (let i = this.laddoos.length - 1; i >= 0; i--) {
            const laddoo = this.laddoos[i];
            laddoo.y += laddoo.speed;
            
            // Remove laddoos that fall off screen
            if (laddoo.y > this.gameHeight) {
                this.laddoos.splice(i, 1);
            }
        }
    }
    
    updateBadObjects() {
        for (let i = this.badObjects.length - 1; i >= 0; i--) {
            const badObject = this.badObjects[i];
            badObject.y += badObject.speed;
            
            // Remove bad objects that fall off screen
            if (badObject.y > this.gameHeight) {
                this.badObjects.splice(i, 1);
            }
        }
    }
    
    checkCollisions() {
        // Check laddoo collisions
        for (let i = this.laddoos.length - 1; i >= 0; i--) {
            const laddoo = this.laddoos[i];
            
            if (this.isColliding(this.catcher, laddoo)) {
                // Catch the laddoo
                this.laddoos.splice(i, 1);
                this.score++;
                
                // Show mouth OPEN briefly, then back to neutral
                this.currentCharImage = 'charClosed';
                if (this.mouthTimeoutId) {
                    clearTimeout(this.mouthTimeoutId);
                }
                this.mouthTimeoutId = setTimeout(() => {
                    this.currentCharImage = 'charOpen';
                    this.mouthTimeoutId = null;
                }, 100);
                
                // Check win condition
                if (this.score >= this.targetScore) {
                    this.endGame();
                }
            }
        }
        
        // Check bad object collisions (only if score > 0)
        if (this.score > 0) {
            for (let i = this.badObjects.length - 1; i >= 0; i--) {
                const badObject = this.badObjects[i];
                
                if (this.isColliding(this.catcher, badObject)) {
                    // Catch the bad object - reduce score
                    this.badObjects.splice(i, 1);
                    this.score = Math.max(0, this.score - 1); // Don't go below 0
                    
                    // Show -1 indicator with animation
                    this.showMinusOne = true;
                    this.minusOneAlpha = 0;
                    this.minusOneScale = 0.5;
                    if (this.minusOneTimeout) {
                        clearTimeout(this.minusOneTimeout);
                    }
                    this.minusOneTimeout = setTimeout(() => {
                        this.showMinusOne = false;
                        this.minusOneTimeout = null;
                    }, 500); // Show for 0.5 seconds
                    
                    // Show mouth OPEN briefly, then back to neutral
                    this.currentCharImage = 'charClosed';
                    if (this.mouthTimeoutId) {
                        clearTimeout(this.mouthTimeoutId);
                    }
                    this.mouthTimeoutId = setTimeout(() => {
                        this.currentCharImage = 'charOpen';
                        this.mouthTimeoutId = null;
                    }, 100);
                }
            }
        }
    }
    
    isColliding(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    }
    
    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.gameWidth, this.gameHeight);
        
        // Draw crying drops (always draw, even on lose screen)
        this.drawCryingDrops();
        
        // Draw trophy drops (always draw, even on win screen)
        this.drawTrophyDrops();
        
        if (!this.gameRunning) return;
        
        // Draw laddoos
        this.laddoos.forEach(laddoo => {
            this.drawLaddoo(laddoo);
        });
        
        // Draw bad objects
        this.badObjects.forEach(badObject => {
            this.drawBadObject(badObject);
        });
        
        // Draw catcher
        this.drawCatcher();
        
        // Draw score
        this.drawScore();
        
        // Draw -1 indicator if showing
        if (this.showMinusOne) {
            this.drawMinusOne();
        }
    }

    resizeCanvas() {
        const container = document.getElementById('gameContainer');
        const cssWidth = container.clientWidth;
        const cssHeight = container.clientHeight;
        
        // Fill by width (use entire page width), maintain aspect via height
        const scale = cssWidth / this.baseWidth;
        
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = Math.floor(this.baseWidth * dpr);
        this.canvas.height = Math.floor(this.baseHeight * dpr);
        const styledWidth = Math.floor(this.baseWidth * scale);
        const styledHeight = Math.floor(this.baseHeight * scale);
        this.canvas.style.width = styledWidth + 'px';
        this.canvas.style.height = styledHeight + 'px';
        
        // If height overflows viewport, cap by height and recompute scale
        if (styledHeight > cssHeight) {
            const altScale = cssHeight / this.baseHeight;
            this.canvas.style.width = Math.floor(this.baseWidth * altScale) + 'px';
            this.canvas.style.height = Math.floor(this.baseHeight * altScale) + 'px';
        }
        
        // Only account for device pixel ratio; keep logical coordinates constant
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    
    drawLaddoo(laddoo) {
        const size = 70; // Increased from 50 to 70
        this.ctx.drawImage(this.images.laddoo, laddoo.x, laddoo.y, size, size);
        laddoo.width = size;
        laddoo.height = size;
    }
    
    drawBadObject(badObject) {
        const size = 50;
        this.ctx.drawImage(this.images[badObject.type], badObject.x, badObject.y, size, size);
        badObject.width = size;
        badObject.height = size;
    }
    
    drawCatcher() {
        const img = this.images[this.currentCharImage];
        // Preserve image aspect ratio and align bottom-center
        const naturalW = img.naturalWidth || 1;
        const naturalH = img.naturalHeight || 1;
        const aspect = naturalW / naturalH;
        const drawHeight = 180; // Fixed height without scaling
        const drawWidth = Math.round(drawHeight * aspect);
        const centerX = this.catcher.x + this.catcher.width / 2;
        const bottomY = this.catcher.y + this.catcher.height;
        const x = Math.round(centerX - drawWidth / 2);
        const y = Math.round(bottomY - drawHeight + 10);
        this.ctx.drawImage(img, x, y, drawWidth, drawHeight);
    }
    
    drawScore() {
        // Create a beautiful score display with background and styling
        const scoreText = `${this.score}/${this.targetScore}`;
        const padding = 12; // Reduced padding
        const fontSize = 18; // Reduced font size
        const fontFamily = 'Arial, sans-serif';
        
        // Set font properties
        this.ctx.font = `bold ${fontSize}px ${fontFamily}`;
        this.ctx.textAlign = 'center';
        
        // Measure text for background sizing
        const textMetrics = this.ctx.measureText(scoreText);
        const textWidth = textMetrics.width;
        const textHeight = fontSize;
        
        // Position at top center
        const x = this.gameWidth / 2;
        const y = 180; // Moved down by another 60px
        const bgWidth = textWidth + padding * 2;
        const bgHeight = textHeight + padding;
        
        // Draw background with gradient
        const gradient = this.ctx.createLinearGradient(x - bgWidth/2, y - bgHeight/2, x + bgWidth/2, y + bgHeight/2);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        gradient.addColorStop(1, 'rgba(200, 200, 200, 0.9)');
        
        // Draw rounded rectangle background
        this.ctx.fillStyle = gradient;
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.lineWidth = 2;
        
        // Create rounded rectangle
        const radius = 10; // Reduced radius
        this.ctx.beginPath();
        this.ctx.roundRect(x - bgWidth/2, y - bgHeight/2, bgWidth, bgHeight, radius);
        this.ctx.fill();
        this.ctx.stroke();
        
        // Draw shadow for depth
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        this.ctx.shadowBlur = 3; // Reduced shadow
        this.ctx.shadowOffsetX = 1;
        this.ctx.shadowOffsetY = 1;
        
        // Draw text with gradient
        const textGradient = this.ctx.createLinearGradient(x - textWidth/2, y - textHeight/2, x + textWidth/2, y + textHeight/2);
        textGradient.addColorStop(0, '#2C3E50');
        textGradient.addColorStop(1, '#34495E');
        
        this.ctx.fillStyle = textGradient;
        this.ctx.fillText(scoreText, x, y + textHeight/4);
        
        // Reset shadow
        this.ctx.shadowColor = 'transparent';
        this.ctx.shadowBlur = 0;
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 0;
    }
    
    updateMinusOneAnimation() {
        if (this.showMinusOne) {
            // Fade in and scale up quickly, then fade out
            if (this.minusOneAlpha < 1) {
                this.minusOneAlpha += 0.2; // Faster fade in
            }
            if (this.minusOneScale < 1) {
                this.minusOneScale += 0.1; // Faster scale up
            }
            
            // Start fading out after 0.3 seconds (300ms)
            if (this.minusOneTimeout && this.minusOneAlpha >= 1) {
                setTimeout(() => {
                    if (this.showMinusOne) {
                        this.minusOneAlpha -= 0.15; // Fade out
                    }
                }, 300);
            }
        }
    }
    
    drawMinusOne() {
        if (!this.showMinusOne) return;
        
        const img = this.images.minusOne;
        if (img && img.complete) {
            this.ctx.save();
            
            // Apply alpha and scale
            this.ctx.globalAlpha = this.minusOneAlpha;
            
            const size = 25 * this.minusOneScale; // Much smaller size with scale
            const x = this.gameWidth / 2 - size / 2;
            
            // Different positioning for mobile vs desktop
            let y;
            if (window.innerWidth <= 768) {
                y = 440; // Adjusted up by 40px on mobile (timer is at 220px + 220px more)
            } else {
                y = 220; // Near the score counter on desktop
            }
            
            this.ctx.drawImage(img, x, y, size, size);
            
            this.ctx.restore();
        }
    }
    
    createMinusOneAnimation() {
        this.minusOneAnimations.push({
            x: this.gameWidth / 2,
            y: 200, // Near the score counter
            alpha: 1.0,
            scale: 1.0,
            life: 60, // 60 frames (about 1 second at 60fps)
            maxLife: 60
        });
    }
    
    updateMinusOneAnimations() {
        for (let i = this.minusOneAnimations.length - 1; i >= 0; i--) {
            const anim = this.minusOneAnimations[i];
            anim.life--;
            
            // Fade out
            anim.alpha = anim.life / anim.maxLife;
            
            // Scale up slightly then down
            if (anim.life > anim.maxLife * 0.7) {
                anim.scale = 1.0 + (1 - anim.life / anim.maxLife) * 0.5;
            } else {
                anim.scale = 1.0 - (1 - anim.life / anim.maxLife) * 0.3;
            }
            
            // Move up slightly
            anim.y -= 0.5;
            
            if (anim.life <= 0) {
                this.minusOneAnimations.splice(i, 1);
            }
        }
    }
    
    drawMinusOneAnimations() {
        this.ctx.save();
        
        for (const anim of this.minusOneAnimations) {
            this.ctx.globalAlpha = anim.alpha;
            this.ctx.font = `bold ${24 * anim.scale}px Arial`;
            this.ctx.fillStyle = '#ff4444';
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 2;
            
            const text = '-1';
            const textWidth = this.ctx.measureText(text).width;
            const x = anim.x - textWidth / 2;
            const y = anim.y;
            
            // Draw stroke (outline)
            this.ctx.strokeText(text, x, y);
            // Draw fill
            this.ctx.fillText(text, x, y);
        }
        
        this.ctx.restore();
    }
    
    startCryingAnimation() {
        console.log('Starting crying animation');
        this.cryingDrops = [];
        this.cryingAnimationId = setInterval(() => {
            this.createCryingDrop();
        }, 500); // Create a new drop every 500ms
    }
    
    stopCryingAnimation() {
        if (this.cryingAnimationId) {
            clearInterval(this.cryingAnimationId);
            this.cryingAnimationId = null;
        }
        this.cryingDrops = [];
    }
    
    createCryingDrop() {
        const sizes = [20, 30, 40, 50]; // Different sizes
        const size = sizes[Math.floor(Math.random() * sizes.length)];
        const speed = 1 + Math.random() * 2; // Random speed between 1-3
        
        this.cryingDrops.push({
            x: Math.random() * this.gameWidth,
            y: -size,
            size: size,
            speed: speed,
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 4
        });
        
        console.log('Created crying drop, total drops:', this.cryingDrops.length);
    }
    
    updateCryingDrops() {
        for (let i = this.cryingDrops.length - 1; i >= 0; i--) {
            const drop = this.cryingDrops[i];
            drop.y += drop.speed;
            drop.rotation += drop.rotationSpeed;
            
            // Remove drops that fall off screen
            if (drop.y > this.gameHeight + drop.size) {
                this.cryingDrops.splice(i, 1);
            }
        }
    }
    
    drawCryingDrops() {
        if (!this.cryingCtx) return;
        
        const img = this.images.cry;
        if (!img || !img.complete) {
            console.log('Cry image not loaded:', img);
            return;
        }
        
        // Clear crying canvas
        this.cryingCtx.clearRect(0, 0, this.cryingCanvas.width, this.cryingCanvas.height);
        
        console.log('Drawing crying drops:', this.cryingDrops.length);
        
        this.cryingCtx.save();
        
        for (const drop of this.cryingDrops) {
            this.cryingCtx.save();
            this.cryingCtx.translate(drop.x + drop.size/2, drop.y + drop.size/2);
            this.cryingCtx.rotate(drop.rotation * Math.PI / 180);
            this.cryingCtx.drawImage(img, -drop.size/2, -drop.size/2, drop.size, drop.size);
            this.cryingCtx.restore();
        }
        
        this.cryingCtx.restore();
    }
    
    startTrophyAnimation() {
        console.log('Starting trophy animation');
        this.trophyDrops = [];
        this.trophyAnimationId = setInterval(() => {
            this.createTrophyDrop();
        }, 600); // Create a new trophy every 600ms
    }
    
    stopTrophyAnimation() {
        if (this.trophyAnimationId) {
            clearInterval(this.trophyAnimationId);
            this.trophyAnimationId = null;
        }
        this.trophyDrops = [];
    }
    
    createTrophyDrop() {
        const sizes = [25, 35, 45, 55]; // Different sizes for trophies
        const size = sizes[Math.floor(Math.random() * sizes.length)];
        const speed = 1.5 + Math.random() * 2; // Random speed between 1.5-3.5
        
        this.trophyDrops.push({
            x: Math.random() * this.gameWidth,
            y: -size,
            size: size,
            speed: speed,
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 3
        });
        
        console.log('Created trophy drop, total drops:', this.trophyDrops.length);
    }
    
    updateTrophyDrops() {
        for (let i = this.trophyDrops.length - 1; i >= 0; i--) {
            const drop = this.trophyDrops[i];
            drop.y += drop.speed;
            drop.rotation += drop.rotationSpeed;
            
            // Remove drops that fall off screen
            if (drop.y > this.gameHeight + drop.size) {
                this.trophyDrops.splice(i, 1);
            }
        }
    }
    
    drawTrophyDrops() {
        if (!this.trophyCtx) return; // Use trophyCtx
        
        const img = this.images.trophy;
        if (!img || !img.complete) {
            console.log('Trophy image not loaded:', img);
            return;
        }
        
        // Clear trophy canvas
        this.trophyCtx.clearRect(0, 0, this.trophyCanvas.width, this.trophyCanvas.height);
        
        console.log('Drawing trophy drops:', this.trophyDrops.length);
        
        this.trophyCtx.save();
        
        for (const drop of this.trophyDrops) {
            this.trophyCtx.save();
            this.trophyCtx.translate(drop.x + drop.size/2, drop.y + drop.size/2);
            this.trophyCtx.rotate(drop.rotation * Math.PI / 180);
            this.trophyCtx.drawImage(img, -drop.size/2, -drop.size/2, drop.size, drop.size);
            this.trophyCtx.restore();
        }
        
        this.trophyCtx.restore();
    }
    
    startConfettiAnimation() {
        if (!this.confettiContainer) {
            console.log('Confetti container not found');
            return;
        }
        
        if (typeof lottie === 'undefined') {
            console.log('Lottie library not loaded');
            return;
        }
        
        console.log('Starting confetti animation');
        
        // Clear any existing animation
        this.stopConfettiAnimation();
        
        try {
            // Load and play confetti animation
            this.confettiAnimation = lottie.loadAnimation({
                container: this.confettiContainer,
                renderer: 'svg', // Try SVG renderer first
                loop: true,
                autoplay: true,
                path: 'assets/Confetti.json'
            });
            
            // Add event listeners for debugging
            this.confettiAnimation.addEventListener('DOMLoaded', () => {
                console.log('Confetti animation DOM loaded');
            });
            
            this.confettiAnimation.addEventListener('data_ready', () => {
                console.log('Confetti animation data ready');
            });
            
            this.confettiAnimation.addEventListener('complete', () => {
                console.log('Confetti animation complete');
            });
            
            this.confettiAnimation.addEventListener('error', (error) => {
                console.error('Confetti animation error:', error);
            });
            
            console.log('Confetti animation loaded successfully');
        } catch (error) {
            console.error('Error loading confetti animation:', error);
        }
    }
    
    stopConfettiAnimation() {
        if (this.confettiAnimation) {
            this.confettiAnimation.destroy();
            this.confettiAnimation = null;
        }
        
        // Clear confetti container
        if (this.confettiContainer) {
            this.confettiContainer.innerHTML = '';
        }
        
        console.log('Confetti animation stopped');
    }
    
    gameLoop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    new LaddooGame();
});
