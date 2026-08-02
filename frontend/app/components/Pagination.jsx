import Button from "./ui/Button";
import { PAGE_SIZE, paginationItems } from "../utils/pagination";

export default function Pagination({ page, totalRows, onPageChange, pageSize = PAGE_SIZE }) {
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = totalRows ? (currentPage - 1) * pageSize + 1 : 0;
  const end = Math.min(currentPage * pageSize, totalRows);

  return (
    <div className="pagination">
      <span>
        {start}-{end} of {totalRows}
      </span>
      <div className="pagination-actions">
        <Button
          className="icon-page"
          variant="secondary"
          onClick={() => onPageChange(1)}
          disabled={currentPage <= 1}
          title="First page"
        >
          {"<<"}
        </Button>
        <Button
          className="icon-page"
          variant="secondary"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          title="Previous page"
        >
          {"<"}
        </Button>
        {paginationItems(currentPage, totalPages).map((item, index) =>
          item === "ellipsis" ? (
            <span className="page-ellipsis" key={`ellipsis-${index}`}>
              ...
            </span>
          ) : (
            <Button
              className={`page-number ${item === currentPage ? "active" : ""}`}
              variant="secondary"
              disabled={item === currentPage}
              key={item}
              onClick={() => onPageChange(item)}
            >
              {item}
            </Button>
          )
        )}
        <Button
          className="icon-page"
          variant="secondary"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          title="Next page"
        >
          {">"}
        </Button>
        <Button
          className="icon-page"
          variant="secondary"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages}
          title="Last page"
        >
          {">>"}
        </Button>
      </div>
    </div>
  );
}
