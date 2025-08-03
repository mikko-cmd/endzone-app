'use client';

const LoadingArc = () => {
  return (
    <div className="flex items-center justify-center h-full w-full bg-[#0d0d0d]">
      <svg
        version="1.1"
        id="L1"
        xmlns="http://www.w3.org/2000/svg"
        xmlnsXlink="http://www.w3.org/1999/xlink"
        x="0px"
        y="0px"
        viewBox="0 0 100 100"
        enableBackground="new 0 0 100 100"
        xmlSpace="preserve"
        width="100px"
        height="100px"
      >
        <path
          fill="#fff"
          d="M31.6,3.5C5.9,13.6,9.4,46.3,31.6,62.3C53.9,78.3,86.4,70,96.5,43.7c-5.8,3.3-12.8,2.8-18.1-2.9c-5.3-5.7-6.1-13.7-2.8-19.5c3.3-5.8,11.2-8.1,18.1-6.1C88.4,10.6,63.1,3.5,31.6,3.5z"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 50 50;360 50 50"
            dur="2s"
            repeatCount="indefinite"
          ></animateTransform>
        </path>
        <path
          fill="#fff"
          d="M42.3,39.6c5.7-4.3,13.9-3.1,18.1,2.7c4.3,5.7,3.1,13.9-2.7,18.1c-5.7,4.3-13.9,3.1-18.1-2.7c-4.3-5.7-3.1-13.9,2.7-18.1z"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 50 50;-360 50 50"
            dur="4s"
            repeatCount="indefinite"
          ></animateTransform>
        </path>
      </svg>
    </div>
  );
};

export default LoadingArc;
