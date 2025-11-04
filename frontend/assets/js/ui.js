/**
 * ui.js - UI Animations and Dynamic Updates
 * 
 * Handles:
 * - Theme toggle functionality
 * - Battery level animations and color updates
 * - Progress bar animations
 * - Dynamic value updates with smooth transitions
 * - UI element hover effects
 * - Modal animations
 * - Button state animations
 */

document.addEventListener('DOMContentLoaded', function() {
    initializeThemeToggle();
    initializeBatteryAnimations();
    initializeUIAnimations();
});

// ================== THEME MANAGEMENT ==================

function initializeThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    
    if (themeToggle) {
        themeToggle.addEventListener('change', function() {
            document.body.classList.toggle('light-theme');
            if (document.body.classList.contains('light-theme')) {
                localStorage.setItem('theme', 'light');
            } else {
                localStorage.setItem('theme', 'dark');
            }
        });
        
        // Check for saved theme preference
        if (localStorage.getItem('theme') === 'light') {
            setTimeout(() => {
                document.body.classList.add('light-theme');
                themeToggle.checked = true;
            }, 300);
        }
    }
}

// ================== BATTERY ANIMATIONS ==================

function initializeBatteryAnimations() {
    // Monitor battery level changes and update colors
    const batteryObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                const batteryLevel = mutation.target;
                const widthMatch = batteryLevel.style.width.match(/(\d+)/);
                
                if (widthMatch) {
                    const percentage = parseInt(widthMatch[1]);
                    updateBatteryColor(batteryLevel, percentage);
                }
            }
        });
    });
    
    const batteryLevels = document.querySelectorAll('.battery-level');
    batteryLevels.forEach(level => {
        batteryObserver.observe(level, { attributes: true });
    });
}

function updateBatteryColor(batteryElement, percentage) {
    batteryElement.classList.remove('critical', 'low', 'good');
    
    if (percentage <= 20) {
        batteryElement.classList.add('critical');
    } else if (percentage <= 40) {
        batteryElement.classList.add('low');
    } else {
        batteryElement.classList.add('good');
    }
}

// ================== UI ANIMATIONS ==================

function initializeUIAnimations() {
    // Add smooth transitions to all interactive elements
    const interactiveElements = document.querySelectorAll('.btn, .waypoint-item, .status-item, .telemetry-item');
    
    interactiveElements.forEach(element => {
        element.addEventListener('mouseenter', function() {
            this.style.transition = 'all 0.3s ease';
        });
    });
    
    // Animate value changes
    observeValueChanges();
}

function observeValueChanges() {
    const valueElements = document.querySelectorAll('.value, .eta-value, .slider-value');
    
    valueElements.forEach(element => {
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList' || mutation.type === 'characterData') {
                    animateValueChange(mutation.target);
                }
            });
        });
        
        observer.observe(element, { 
            childList: true, 
            characterData: true, 
            subtree: true 
        });
    });
}

function animateValueChange(element) {
    element.style.transition = 'all 0.3s ease';
    element.style.transform = 'scale(1.05)';
    element.style.color = 'var(--color-interactive-primary)';
    
    setTimeout(() => {
        element.style.transform = 'scale(1)';
        element.style.color = '';
    }, 300);
}

// ================== PROGRESS BAR ANIMATIONS ==================

function animateProgressBar(element, targetWidth, duration = 1000) {
    const startWidth = parseFloat(element.style.width) || 0;
    const startTime = performance.now();
    
    function updateProgress(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const easeOutQuad = progress * (2 - progress);
        const currentWidth = startWidth + (targetWidth - startWidth) * easeOutQuad;
        
        element.style.width = currentWidth + '%';
        
        if (progress < 1) {
            requestAnimationFrame(updateProgress);
        }
    }
    
    requestAnimationFrame(updateProgress);
}

window.animateProgressBar = animateProgressBar;

// ================== MODAL ANIMATIONS ==================

function showModal(modalElement) {
    if (!modalElement) return;
    
    modalElement.style.display = 'flex';
    modalElement.style.opacity = '0';
    
    requestAnimationFrame(() => {
        modalElement.style.transition = 'opacity 0.3s ease';
        modalElement.style.opacity = '1';
    });
}

function hideModal(modalElement) {
    if (!modalElement) return;
    
    modalElement.style.transition = 'opacity 0.3s ease';
    modalElement.style.opacity = '0';
    
    setTimeout(() => {
        modalElement.style.display = 'none';
    }, 300);
}

window.showModal = showModal;
window.hideModal = hideModal;

// ================== BUTTON STATE ANIMATIONS ==================

function setButtonLoading(button, isLoading) {
    if (!button) return;
    
    if (isLoading) {
        button.disabled = true;
        button.dataset.originalContent = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        button.style.opacity = '0.7';
    } else {
        button.disabled = false;
        button.innerHTML = button.dataset.originalContent || button.innerHTML;
        button.style.opacity = '1';
    }
}

window.setButtonLoading = setButtonLoading;

// ================== NOTIFICATION ANIMATIONS ==================

function showNotification(message, type = 'info', duration = 3000) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: var(--color-surface-elevated);
        border: 1px solid var(--color-border-default);
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 3000;
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    requestAnimationFrame(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    });
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, duration);
}

window.showNotification = showNotification;

// ================== SMOOTH SCROLL ANIMATIONS ==================

function smoothScrollTo(element, duration = 500) {
    if (!element) return;
    
    const start = element.scrollTop;
    const target = element.scrollHeight;
    const startTime = performance.now();
    
    function scroll(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const easeInOutQuad = progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        
        element.scrollTop = start + (target - start) * easeInOutQuad;
        
        if (progress < 1) {
            requestAnimationFrame(scroll);
        }
    }
    
    requestAnimationFrame(scroll);
}

window.smoothScrollTo = smoothScrollTo;
