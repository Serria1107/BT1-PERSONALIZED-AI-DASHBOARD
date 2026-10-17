# Nhật ký sử dụng AI

Nhật ký này ghi lại ba giai đoạn được yêu cầu. Các phần được triển khai trong cùng một lượt làm việc; kết quả dưới đây chỉ mô tả những gì đã thực hiện và xác minh, không coi các bước chưa chạy là đã kiểm tra.

## Giai đoạn 1: The Skeleton

1. **Yêu cầu gửi AI:** Tạo cấu trúc HTML5 semantic, giao diện dashboard quản lý công việc bằng CSS Grid và Flexbox, responsive từ mobile đến desktop, có sidebar có thể đóng/mở trên màn hình nhỏ.
2. **AI hỗ trợ tạo:** `index.html` với sidebar, header cá nhân hóa, đồng hồ, thống kê, form thêm việc, bộ lọc, danh sách, empty state và hộp thoại đổi tên; `style.css` với bố cục, trạng thái tương tác và media query.
3. **Điều chỉnh đã thực hiện:** Dùng các thành phần HTML gốc, SVG nội tuyến không phụ thuộc thư viện, trạng thái focus nhìn thấy được, hỗ trợ giảm chuyển động và lớp nền đóng menu mobile.
4. **Kiểm tra / vấn đề:** Đã mở website trong trình duyệt, xác nhận các vùng nội dung và điều hướng được render. Đo tại chiều rộng 320, 375, 768 và 1280 px không phát hiện tràn ngang. Khi kiểm tra đã phát hiện và sửa CSS ghi đè thuộc tính `hidden` của empty state.

## Giai đoạn 2: The Interactions

1. **Yêu cầu gửi AI:** Thêm, sửa, xóa, hoàn thành công việc; từ chối nội dung rỗng; lọc theo trạng thái; cập nhật thống kê và xử lý danh sách động bằng event delegation.
2. **AI hỗ trợ tạo:** `script.js` với các thao tác DOM, render danh sách bằng phần tử tạo động, bộ lọc đồng bộ ở sidebar và khu vực nội dung, thông báo empty state và cập nhật thống kê.
3. **Điều chỉnh đã thực hiện:** Dùng `textContent` cho nội dung do người dùng nhập; thao tác hoàn thành chỉ gắn với nút trạng thái; nút sửa/xóa/hủy là các hành động riêng; sửa giữ nguyên trạng thái hiện tại.
4. **Kiểm tra / vấn đề:** Đã kiểm tra thêm bằng Enter, cảnh báo khi để trống, đánh dấu hoàn thành, lọc trạng thái, sửa bằng Enter, xóa và cập nhật thống kê. Sidebar mobile mở được và tự đóng khi chọn mục. Chưa kiểm tra riêng tình huống lưu nội dung sửa rỗng hoặc nhập chỉ dấu cách.

## Giai đoạn 3: The Persistence

1. **Yêu cầu gửi AI:** Lưu/khôi phục công việc và tên bằng LocalStorage, giữ trạng thái hoàn thành, cập nhật đồng hồ mỗi giây và xử lý dữ liệu lưu không hợp lệ.
2. **AI hỗ trợ tạo:** `script.js` đọc/ghi JSON cho công việc và tên, khôi phục dữ liệu khi tải trang, cập nhật đồng hồ hệ thống; `NHAT_KY_AI.md` ghi lại quá trình theo ba giai đoạn.
3. **Điều chỉnh đã thực hiện:** Kiểm tra định dạng từng công việc sau khi parse; loại dữ liệu sai định dạng; hiển thị thông báo rõ ràng nếu không thể truy cập/lưu LocalStorage. Dữ liệu công việc không được khởi tạo bằng danh sách mẫu.
4. **Kiểm tra / vấn đề:** Đã xác nhận tải lại trang khôi phục công việc cùng trạng thái hoàn thành và khôi phục tên hiển thị. Đồng hồ hiển thị theo giờ hệ thống; lần tải lại được theo dõi không có lỗi JavaScript/console. Chưa mô phỏng dữ liệu LocalStorage hỏng hoặc đóng hẳn rồi mở lại trình duyệt.

## Tổng kết xác minh

- Đã xác minh trực tiếp trên trình duyệt qua `file://` sau khi triển khai; các chiều rộng 320, 375, 768 và 1280 px không có tràn ngang.
- Đã thao tác thêm, sửa, xóa, hoàn thành, lọc, cảnh báo input rỗng, đổi tên và tải lại để kiểm tra persistence.
- Không có lỗi trang hoặc lỗi console trong lần reload được theo dõi.
- Chưa kiểm tra riêng nội dung sửa rỗng, input chỉ có dấu cách, dữ liệu LocalStorage hỏng, trình duyệt khác hoặc đóng/mở lại toàn bộ trình duyệt.

## Lần nâng cấp: Quản lý và phân công công việc

1. **Yêu cầu gửi AI:** Nâng cấp dự án hiện tại (không thay framework) để tạo công việc có người giao, mô tả, hạn và mức ưu tiên; nhận/trả việc, quản lý trạng thái, xem chi tiết, tìm kiếm, lọc và thống kê; bảo toàn danh sách LocalStorage cũ.
2. **AI hỗ trợ cập nhật:** Thay đổi `index.html` để bổ sung form tạo/sửa, modal nhận việc, modal chi tiết/xác nhận, lọc và tìm kiếm; cập nhật `style.css` cho thẻ công việc, nhãn trạng thái/ưu tiên/hạn và modal responsive; xây dựng lại `script.js` với schema công việc mới, migration, persistence và luồng trạng thái.
3. **Điều chỉnh đã thực hiện:** Giữ nguyên key `focusly.tasks` và `focusly.userName`; chuyển `text` cũ thành `title`, giữ trạng thái hoàn thành, không tự tạo deadline/ngày cho dữ liệu cũ và sao lưu JSON gốc trước migration. Dữ liệu JSON hỏng được sao lưu và không bị xóa. Các tác vụ yêu cầu xác nhận trước khi trả, xóa hoặc mở lại công việc đã xong. Giao/nhận là mô phỏng trong một trình duyệt, không xác thực danh tính hoặc đồng bộ nhiều thiết bị.
4. **Kiểm tra / vấn đề:** Đã chạy kiểm tra thao tác trên trình duyệt: tạo công việc đủ thông tin, từ chối deadline quá khứ, nhận với tên người nhận, ẩn thao tác nhận trùng, bắt đầu, hoàn thành, mở lại, trả về chờ nhận, sửa mà vẫn giữ người nhận, tìm theo tên người giao/người nhận/mô tả, lọc trạng thái và khôi phục người nhận sau reload. Đã kiểm tra badge sắp hết hạn, quá hạn và hoàn thành trễ; migration hai tác vụ legacy (một đã xong, một chưa xong) cùng bản sao dữ liệu gốc; JSON lỗi được giữ ở khóa recovery. Đo viewport 320/375/768/1280 px không phát hiện tràn ngang; menu mobile mở và đóng sau điều hướng; lần smoke test cuối không ghi nhận lỗi console. Dữ liệu kiểm thử trong trình duyệt đã được dọn. Trong quá trình kiểm tra đã phát hiện ReferenceError ở nhánh sửa dữ liệu legacy thiếu mô tả; đã sửa thứ tự khởi tạo điều kiện và kiểm tra thao tác sửa thành công sau đó. Chưa tự động chạy toàn bộ 30 tình huống của đề; chưa kiểm tra bằng nhiều trình duyệt hoặc nhiều thiết bị.
