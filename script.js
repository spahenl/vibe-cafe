// ===================================================
// Supabase 설정 상수
// Supabase 대시보드의 Project Settings -> API에서 확인한 값을 입력하세요.
// ===================================================
const SUPABASE_URL = 'https://buhragpnnllpknqwebzn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1aHJhZ3BubmxscGtucXdlYnpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzOTU2MjIsImV4cCI6MjEwNjk3MTYyMn0.HfAO0AkKX_P1jhUPCyVvsWY7F6qmzdvUNpvhiWySaTE';

// Supabase 클라이언트 초기화 (CDN으로 로드된 window.supabase 사용)
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// ===================================================
// HTML 문서(DOM)가 모두 로드된 후 스크립트 실행
// ===================================================
document.addEventListener('DOMContentLoaded', () => {
  // ---------------------------------------------------
  // DOM 요소 가져오기
  // index.html에 작성된 id를 그대로 사용하여 요소를 선택합니다.
  // ---------------------------------------------------
  const orderForm = document.getElementById('orderForm');
  const customerNameInput = document.getElementById('customerName');
  const customerPhoneInput = document.getElementById('customerPhone');
  const beverageSelect = document.getElementById('beverage');
  const quantityInput = document.getElementById('quantity');
  const requestsTextarea = document.getElementById('requests');
  const estimatedPriceSpan = document.getElementById('estimatedPrice');
  const submitBtn = document.getElementById('submitBtn');
  const orderConfirmationDiv = document.getElementById('orderConfirmation');

  if (!orderForm || !beverageSelect || !quantityInput || !estimatedPriceSpan) {
    console.error('필수 DOM 요소를 찾을 수 없습니다.');
    return;
  }

  // ---------------------------------------------------
  // 예상 금액 화면 표시 헬퍼 함수
  // ---------------------------------------------------
  function updatePriceDisplay(price) {
    // toLocaleString()을 사용해 1,000 단위 콤마(예: 5,000)를 적용합니다.
    estimatedPriceSpan.textContent = price.toLocaleString();
  }

  // ---------------------------------------------------
  // 금액 계산 함수: calculateTotal()
  // 음료, 사이즈, 추가 옵션, 수량을 바탕으로 총 금액을 계산합니다.
  // ---------------------------------------------------
  function calculateTotal() {
    // 1. 선택된 음료 확인
    const selectedOption = beverageSelect.options[beverageSelect.selectedIndex];
    // 음료의 data-price 속성값을 숫자로 변환 (음료를 안 골랐으면 0)
    const beveragePrice = Number(selectedOption.dataset.price) || 0;

    // 음료를 선택하지 않았다면(음료 가격이 0원이거나 선택값이 없으면) 예상 금액은 0원
    if (!beverageSelect.value || beveragePrice === 0) {
      updatePriceDisplay(0);
      return 0;
    }

    // 2. 선택된 사이즈 추가 금액 확인
    // 현재 체크된 라디오 버튼(name="size")을 찾습니다.
    const checkedSize = document.querySelector('input[name="size"]:checked');
    const sizePrice = checkedSize ? (Number(checkedSize.dataset.price) || 0) : 0;

    // 3. 선택된 추가 옵션들의 금액 합산
    // 체크된 모든 체크박스(name="extraOptions")를 찾아서 금액을 더합니다.
    const checkedOptions = document.querySelectorAll('input[name="extraOptions"]:checked');
    let optionsPrice = 0;
    checkedOptions.forEach((option) => {
      optionsPrice += Number(option.dataset.price) || 0;
    });

    // 4. 수량 확인 (기본값 1, 최소 1)
    let quantity = parseInt(quantityInput.value, 10);
    if (isNaN(quantity) || quantity < 1) {
      quantity = 1;
    }

    // 5. 한 잔당 가격 = 음료 기본 가격 + 사이즈 추가금 + 옵션 추가금
    const pricePerCup = beveragePrice + sizePrice + optionsPrice;

    // 총 금액 = 한 잔당 가격 * 수량
    const totalPrice = pricePerCup * quantity;

    // 화면의 예상 금액 표시 업데이트 (천 단위 콤마 적용)
    updatePriceDisplay(totalPrice);

    return totalPrice;
  }

  // ---------------------------------------------------
  // 이벤트 리스너 등록: 실시간 계산
  // 음료, 사이즈, 옵션, 수량이 변경될 때마다 calculateTotal() 실행
  // ---------------------------------------------------

  // 음료 선택 드롭다운이 변경될 때
  beverageSelect.addEventListener('change', calculateTotal);

  // 사이즈 라디오 버튼 또는 옵션 체크박스 등 폼 내부의 입력 상태가 바뀔 때
  orderForm.addEventListener('change', (event) => {
    if (event.target.name === 'size' || event.target.name === 'extraOptions') {
      calculateTotal();
    }
  });

  // 수량이 키보드로 입력되거나 화살표로 바뀔 때 즉시 반영
  quantityInput.addEventListener('input', calculateTotal);

  // ---------------------------------------------------
  // 주문하기 버튼 클릭 (폼 제출: submit 이벤트)
  // 비동기 통신(async/await)을 통해 Supabase에 주문을 저장합니다.
  // ---------------------------------------------------
  orderForm.addEventListener('submit', async (event) => {
    // 폼 제출 시 페이지가 새로고침되는 기본 동작을 막습니다.
    event.preventDefault();

    // 1. 이름 유효성 검사 (공백 제거 후 확인)
    const customerName = customerNameInput.value.trim();
    if (!customerName) {
      alert('이름을 입력해주세요');
      customerNameInput.focus();
      return;
    }

    // 2. 음료 선택 유효성 검사
    if (!beverageSelect.value) {
      alert('음료를 선택해주세요');
      beverageSelect.focus();
      return;
    }

    // 3. 최종 금액 계산
    const total = calculateTotal();

    // 4. 입력 및 선택값 파싱
    // 음료 기본 가격 (data-price 속성값)
    const selectedOption = beverageSelect.options[beverageSelect.selectedIndex];
    const drinkPrice = Number(selectedOption.dataset.price) || 0;

    // 음료 이름 가져오기 (예: "카페라떼 (4,000원)" -> "카페라떼")
    const selectedOptionText = selectedOption.text;
    const beverageName = selectedOptionText.split(' (')[0].trim();

    // 사이즈 이름 가져오기 (예: S, M, L)
    const checkedSize = document.querySelector('input[name="size"]:checked');
    const sizeName = checkedSize ? checkedSize.value : 'M';

    // 수량 가져오기
    let quantity = parseInt(quantityInput.value, 10);
    if (isNaN(quantity) || quantity < 1) {
      quantity = 1;
    }

    // 전화번호 및 요청사항
    const phone = customerPhoneInput ? customerPhoneInput.value.trim() : '';
    const request = requestsTextarea ? requestsTextarea.value.trim() : '';

    // 선택된 추가 옵션 배열 및 텍스트 모으기
    const checkedOptions = document.querySelectorAll('input[name="extraOptions"]:checked');
    const optionsArray = []; // Supabase 테이블에 배열로 저장할 옵션 이름들
    checkedOptions.forEach((option) => {
      // label 요소에서 이름 추출 (예: "샷 추가 (+500원)" -> "샷 추가")
      const label = document.querySelector(`label[for="${option.id}"]`);
      if (label) {
        const cleanOptionName = label.textContent.split(' (')[0].trim();
        optionsArray.push(cleanOptionName);
      } else {
        optionsArray.push(option.value);
      }
    });

    // 화면 안내 문구용 옵션 텍스트 (예: " (샷 추가, 시럽 추가)")
    let optionsText = '';
    if (optionsArray.length > 0) {
      optionsText = ` (${optionsArray.join(', ')})`;
    }

    // 5. 버튼 중복 클릭 방지 (저장 중 비활성화)
    submitBtn.disabled = true;
    const originalBtnText = submitBtn.textContent;
    submitBtn.textContent = '주문 저장 중...';

    // 6. Supabase에 저장할 주문 데이터 객체 구성
    const orderData = {
      customer_name: customerName,
      phone: phone,
      drink: beverageName,
      drink_price: drinkPrice,
      size: sizeName,
      options: optionsArray,      // 문자열 배열 형태로 저장
      quantity: quantity,
      request: request,
      total_price: total
    };

    try {
      // Supabase 클라이언트 유효성 검사
      if (!supabaseClient) {
        throw new Error('Supabase 클라이언트가 초기화되지 않았습니다. SUPABASE_URL과 SUPABASE_KEY를 확인하세요.');
      }

      // cafe_menu03 테이블에 주문 데이터 추가 (insert)
      const { data, error } = await supabaseClient
        .from('cafe_menu03')
        .insert([orderData]);

      // 에러 발생 시 처리
      if (error) {
        throw error;
      }

      // 저장 성공 시: 기존 주문 확인 메시지 화면 표시
      const confirmationMessage = `${customerName}님, ${beverageName} ${sizeName}사이즈${optionsText} ${quantity}잔, 총 ${total.toLocaleString()}원 주문이 접수되었습니다!`;

      if (orderConfirmationDiv) {
        orderConfirmationDiv.textContent = confirmationMessage;
        orderConfirmationDiv.removeAttribute('hidden');
        orderConfirmationDiv.classList.remove('hidden');
        orderConfirmationDiv.scrollIntoView({ behavior: 'smooth' });
      }
    } catch (err) {
      // 저장 실패 시 알림창 띄우기 및 콘솔에 상세 에러 출력
      console.error('주문 저장 실패 에러:', err);
      alert('주문 저장에 실패했어요');
    } finally {
      // 저장 완료 후 (성공/실패 무관) 버튼 다시 활성화
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
    }
  });

  // ---------------------------------------------------
  // 다시 작성 버튼 클릭 (reset 이벤트)
  // ---------------------------------------------------
  orderForm.addEventListener('reset', () => {
    setTimeout(() => {
      // M 사이즈를 기본 선택으로 복원
      const sizeMRadio = document.getElementById('sizeM');
      if (sizeMRadio) {
        sizeMRadio.checked = true;
      }

      // 수량을 기본값 1로 복원
      quantityInput.value = 1;

      // 예상 금액을 0원으로 재계산 및 초기화
      calculateTotal();

      // 주문 확인 메시지 영역 숨기기
      if (orderConfirmationDiv) {
        orderConfirmationDiv.textContent = '';
        orderConfirmationDiv.setAttribute('hidden', '');
        orderConfirmationDiv.classList.add('hidden');
      }
    }, 0);
  });

  // ---------------------------------------------------
  // 페이지 첫 로드 시 초기 금액 표시 설정 (초기값: 0원)
  // ---------------------------------------------------
  calculateTotal();
});
